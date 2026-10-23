/**
 * Compares a filled blind-solve file with the bank's keys, using the engine's
 * own scoring. A report only: it always exits 0.
 *
 *   pnpm bank:blind-compare --level b1 --answers <file>
 */
import { readFileSync } from "node:fs";
import { SEED_BANK } from "../src/db/seed-bank";
import { parseAnswerFile, toItemAnswer } from "../src/db/seed-bank/blind-answers";
import { blindItems, parseArgs, parseLevel, type BlindItem } from "../src/db/seed-bank/blind-items";
import { scoreItem } from "../src/lib/exam/item-scoring";
import type { ItemAnswer, ItemKey } from "../src/lib/exam/types";

const args = parseArgs(process.argv.slice(2));
const level = parseLevel(args.level);
if (!args.answers) throw new Error("--answers <file> is required");

const raw = parseAnswerFile(readFileSync(args.answers, "utf8"));
const items = blindItems(SEED_BANK, level);
const known = new Set(items.map((i) => i.seedKey));

function show(answer: ItemAnswer | null): string {
  if (!answer) return "-";
  if (answer.choiceIds) return answer.choiceIds.join(",");
  if (answer.tfng) return Object.entries(answer.tfng).map(([k, v]) => `${k}=${v}`).join(", ");
  if (answer.gaps) return Object.entries(answer.gaps).map(([k, v]) => `${k}=${v}`).join(", ");
  if (answer.matches) return Object.entries(answer.matches).map(([k, v]) => `${k}=${v}`).join(", ");
  return "-";
}

function showKey(key: ItemKey): string {
  switch (key.kind) {
    case "CHOICE":
      return key.correct.join(",");
    case "TFNG":
      return Object.entries(key.answers).map(([k, v]) => `${k}=${v}`).join(", ");
    case "GAP":
      return Object.entries(key.answers).map(([k, v]) => `${k}=${v.join("/")}`).join(", ");
    case "MATCHING":
      return Object.entries(key.pairs).map(([k, v]) => `${k}=${v}`).join(", ");
    case "SHORT_TEXT":
      return key.accepted.join("/");
    case "NONE":
      return "-";
  }
}

function solverView(it: BlindItem, answer: ItemAnswer | null): string {
  const c = it.item.content;
  if (c.kind === "MATCHING" && answer?.matches) {
    const byId = Object.fromEntries(Object.entries(it.letterToRightId).map(([letter, id]) => [id, letter]));
    return Object.entries(answer.matches).map(([k, v]) => `${k}=${byId[v] ?? v}`).join(", ");
  }
  return show(answer);
}

const counts = { agree: 0, disagree: 0, unanswered: 0 };
for (const it of items) {
  const pairs = raw.get(it.seedKey);
  const answer = toItemAnswer(it.item.content, pairs, it.letterToRightId);
  const label = `${it.seedKey} (${it.item.skillTag})`;
  if (!answer) {
    counts.unanswered++;
    console.log(`UNANSWERED  ${label}`);
    continue;
  }
  const s = scoreItem(it.item.type, it.item.content, it.item.key, answer);
  if (s?.correct) {
    counts.agree++;
    console.log(`agree       ${label}`);
  } else {
    counts.disagree++;
    const keyView =
      it.item.content.kind === "MATCHING"
        ? Object.entries(it.item.key.kind === "MATCHING" ? it.item.key.pairs : {})
            .map(([k, v]) => `${k}=${Object.entries(it.letterToRightId).find(([, id]) => id === v)?.[0] ?? v}`)
            .join(", ")
        : showKey(it.item.key);
    console.log(`DISAGREE    ${label}  score=${s?.score ?? 0}\n              solver: ${solverView(it, answer)}\n              key:    ${keyView}`);
  }
}
for (const k of raw.keys()) if (!known.has(k)) console.log(`UNKNOWN KEY in answers file (not an objective ${level} item): ${k}`);
console.log(`\n${items.length} items: ${counts.agree} agree, ${counts.disagree} disagree, ${counts.unanswered} unanswered`);
