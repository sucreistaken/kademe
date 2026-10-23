import { matchingTargets, toCandidateItem, type CandidateContent, type CandidateItem } from "@/lib/exam/safe";
import type { Cefr, ItemSnapshot } from "@/lib/exam/types";
import { SHORT_TEXT_ID } from "./blind-answers";
import { seedItemKey } from "./seed-key";
import type { SeedBankPart, SeedItem, SeedStimulus } from "./types";

/** The objective items of one level with their seed keys, shared by the blind export and compare scripts. */
export type BlindItem = {
  seedKey: string;
  item: SeedItem;
  stimulus: SeedStimulus | null;
  snapshot: ItemSnapshot;
  /** What the solver sees, from the engine's own whitelist. */
  candidate: CandidateItem;
  /** Matching only: the letter a row's target shows, to the right column id. */
  letterToRightId: Record<string, string>;
};

export function blindItems(bank: SeedBankPart, level: Cefr): BlindItem[] {
  const stimuli = new Map(bank.stimuli.map((s) => [s.key, s]));
  const out: BlindItem[] = [];
  for (const item of bank.items) {
    if (item.level !== level) continue;
    if (item.section !== "GRAMMAR" && item.section !== "READING" && item.section !== "LISTENING") continue;
    if (item.key.kind === "NONE") continue;
    const stimulus = item.stimulusKey ? (stimuli.get(item.stimulusKey) ?? null) : null;
    const seedKey = seedItemKey(item);
    const snapshot: ItemSnapshot = {
      id: seedKey,
      section: item.section,
      level: item.level,
      difficulty: 0,
      type: item.type,
      skillTag: item.skillTag,
      stimulusId: stimulus?.key ?? null,
      orderInStimulus: 0,
      prompt: item.prompt,
      content: item.content,
      key: item.key,
      rubric: null,
      points: 1,
      stimulus: stimulus
        ? {
            id: stimulus.key,
            section: stimulus.section,
            level: stimulus.level,
            title: stimulus.title,
            body: stimulus.body,
            audioKey: null,
            audioDurationMs: null,
          }
        : null,
    };
    const candidate = toCandidateItem(snapshot, {}, null, out.length + 1, { maxPlays: 1 });
    const letterToRightId: Record<string, string> = {};
    if (item.content.kind === "MATCHING") {
      for (const t of matchingTargets(item.content.right)) letterToRightId[t.badge] = t.id;
    }
    out.push({ seedKey, item, stimulus, snapshot, candidate, letterToRightId });
  }
  return out;
}

/** Plain argument parser: `--name value` pairs, `--flag` alone is "true". */
export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[a.slice(2)] = next;
      i++;
    } else out[a.slice(2)] = "true";
  }
  return out;
}

export function parseLevel(raw: string | undefined): Cefr {
  const up = (raw ?? "").toUpperCase();
  if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(up)) throw new Error("--level must be one of a1 a2 b1 b2 c1 c2");
  return up as Cefr;
}

/** "[Bild: <alt>] " from the RAW seed content, so the solver reads what the picture shows. */
function picture(x: { image?: { alt?: string } } | null | undefined): string {
  const alt = x?.image?.alt;
  return alt ? `[Bild: ${alt}] ` : "";
}

/** The answer slots the solver sees for one item, plus its answer template line. */
export function renderSlots(item: BlindItem): { lines: string[]; template: string } {
  const c: CandidateContent = item.candidate.content;
  const raw = item.item.content;
  const lines: string[] = [];
  switch (c.kind) {
    case "CHOICE": {
      const rawOptions = raw.kind === "CHOICE" ? raw.options : [];
      for (const o of c.options) lines.push(`- (${o.id}) ${picture(rawOptions.find((r) => r.id === o.id))}${o.text}`.trimEnd());
      if (c.multiple && c.pick !== undefined) lines.push(`Kreuzen Sie ${c.pick} an.`);
      return {
        lines,
        template: `${item.seedKey}: choice=${c.multiple ? "... (several ids, comma separated)" : "..."}`,
      };
    }
    case "TFNG": {
      c.statements.forEach((s, i) => {
        const src = raw.kind === "TFNG" ? raw.statements[i] : null;
        lines.push(`${s.id}. ${picture(src as { image?: { alt?: string } } | null)}${s.text}`);
      });
      if (c.wording === "JA_NEIN") {
        lines.push(
          c.twoWay
            ? "Antwort je Aussage: J (ja) oder N (nein)."
            : "Antwort je Aussage: J (ja), N (nein) oder T (Text sagt dazu nichts).",
        );
      } else {
        lines.push(c.twoWay ? "Antwort je Aussage: R (richtig) oder F (falsch)." : "Antwort je Aussage: R (richtig), F (falsch) oder NG (nicht im Text).");
      }
      return { lines, template: `${item.seedKey}: ${c.statements.map((s) => `${s.id}=...`).join(", ")}` };
    }
    case "GAP":
      for (const g of c.gaps) {
        const hint = g.choices ? ` Auswahl: ${g.choices.join(" | ")}` : "";
        lines.push(`- [${g.id}]${hint}`);
      }
      if (c.pool) lines.push(`Teile / Wörter zur Auswahl: ${c.pool.join(" | ")}`);
      if (c.attached) lines.push("Jede Lücke setzt das Wort davor fort: schreibe das ganze Wort.");
      if (c.open) lines.push("Schreibe in jede Lücke genau ein passendes Wort.");
      return { lines, template: `${item.seedKey}: ${c.gaps.map((g) => `${g.id}=...`).join(", ")}` };
    case "MATCHING": {
      const rightRaw = raw.kind === "MATCHING" ? raw.right : [];
      for (const l of c.left) lines.push(`- ${l.id}: ${l.text}`);
      lines.push("Zuordnen zu:");
      for (const t of matchingTargets(rightRaw)) {
        const alt = picture(rightRaw.find((r) => r.id === t.id));
        lines.push(`- ${t.badge}: ${alt}${t.label}`.trimEnd());
      }
      return { lines, template: `${item.seedKey}: ${c.left.map((l) => `${l.id}=...`).join(", ")}` };
    }
    case "SHORT_TEXT":
      // One typed answer, compared by the engine's own scoring like a typed gap.
      lines.push(`Kurze Antwort (höchstens ${c.maxChars} Zeichen).`);
      return { lines, template: `${item.seedKey}: ${SHORT_TEXT_ID}=...` };
    default:
      return { lines, template: `${item.seedKey}: ...` };
  }
}
