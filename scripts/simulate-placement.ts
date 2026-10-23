/**
 * Gate for grammar as MC cloze and word bank (spec 2026-10-18, section 4).
 * Same simulated students take, per template:
 *   (a) the multiple-choice form before onSET (commit 3c4fd3c^),
 *   (b) today's C-test form (the reference for A1 over-placement),
 *   (c) cloze and word-bank compositions, smallest first,
 * all with guessing in the answers: a quarter on every ordinary item (the
 * engine gives those no floor), a quarter on a cloze gap, one over the pool on
 * a word-bank gap, none on a C-test. A text's gaps share a random effect.
 * A composition passes when `gateFailures` is empty at both seeds; the first
 * (fewest minutes) that passes is the template's form. The bank holds 11-gap
 * cloze texts and 8-gap word banks with 4-5 distractors; 4 is simulated (the
 * larger floor). 14-gap rows are what-ifs: the bank has no such texts.
 * Open cloze trials (spec 2026-10-23): the bank has open cloze texts (OPEN,
 * 9-11 typed gaps, no guessing floor) at B2, C1 and C2; the placement is
 * tried with them in place of the C1 and C2 cloze texts (same minutes), and
 * on top of the earlier form (six cloze texts A1 to C2); (a) is the template since then.
 * Run: pnpm tsx scripts/simulate-placement.ts   (RUNS=1000 for a quick look;
 * ITEM_GUESS=0 to let ordinary items be answered without guessing).
 */
import { section, type BlueprintConfig, type SectionConfig } from "@/lib/exam/blueprint";
import { gateFailures, simulateFixedForm, type FormAccuracy, type SimulationOptions } from "@/lib/exam/form-simulation";
import { examTemplateByKey } from "@/lib/exam/templates";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";

const per = (counts: Partial<Record<Cefr, number>>) => ({
  kind: "ABSOLUTE" as const,
  perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, ...counts },
});
type Key = "placement" | "quick-screen";
const withGrammar = (key: Key, grammar: SectionConfig): BlueprintConfig => {
  const cfg = structuredClone(examTemplateByKey(key)!.config);
  cfg.sections = cfg.sections.map((s) => (s.section === "GRAMMAR" ? grammar : s));
  return cfg;
};

/**
 * Reading time of one text: an 11-gap cloze about 3.5 minutes (about 14 gaps: 4.5), an 8-gap word bank 3, an
 * open cloze (about 10 typed gaps in some 165 words, no options to read) taken as a cloze, 3.5; rounded up to five.
 */
const minutesFor = (cloze: number, wordBanks: number, clozeGaps: number, open = 0) =>
  Math.ceil(((cloze * (clozeGaps >= 14 ? 4.5 : 3.5)) + wordBanks * 3 + open * 3.5) / 5) * 5;
const textsOf = (cloze: Cefr[], wordBanks: Cefr[], open: Cefr[] = []) => [
  ...cloze.map((level) => ({ level, kind: "CLOZE" as const })),
  ...wordBanks.map((level) => ({ level, kind: "WORDBANK" as const })),
  ...open.map((level) => ({ level, kind: "OPEN" as const })),
];

type Candidate = { name: string; cloze: Cefr[]; wordBanks: Cefr[]; clozeGaps: number; open?: Cefr[] };
const ALL = [...CEFR_LEVELS];
const CANDIDATES: Record<Key, Candidate[]> = {
  // Spec start, then the spec's fallbacks in order. A second B1 cloze cannot be
  // expressed: `texts` holds one text per kind and level.
  placement: [
    { name: "6 cloze A1-C2 + 3 word banks A2-B2", cloze: ALL, wordBanks: ["A2", "B1", "B2"], clozeGaps: 11 },
    { name: "same, 14 gaps per cloze (what-if)", cloze: ALL, wordBanks: ["A2", "B1", "B2"], clozeGaps: 14 },
    { name: "6 cloze + 4 word banks A2-C1", cloze: ALL, wordBanks: ["A2", "B1", "B2", "C1"], clozeGaps: 11 },
  ],
  "quick-screen": [
    { name: "3 cloze A2-B2 + word bank B1", cloze: ["A2", "B1", "B2"], wordBanks: ["B1"], clozeGaps: 11 },
    { name: "same, 14 gaps per cloze (what-if)", cloze: ["A2", "B1", "B2"], wordBanks: ["B1"], clozeGaps: 14 },
    { name: "4 cloze A1-B2 + word bank B1", cloze: ["A1", "A2", "B1", "B2"], wordBanks: ["B1"], clozeGaps: 11 },
    { name: "3 cloze A2-B2 + word banks A2, B1", cloze: ["A2", "B1", "B2"], wordBanks: ["A2", "B1"], clozeGaps: 11 },
    { name: "3 cloze A2-B2 + word banks A1-B1", cloze: ["A2", "B1", "B2"], wordBanks: ["A1", "A2", "B1"], clozeGaps: 11 },
    { name: "3 cloze A2-B2 + word banks A2-B2", cloze: ["A2", "B1", "B2"], wordBanks: ["A2", "B1", "B2"], clozeGaps: 11 },
    { name: "4 cloze A1-B2 + word banks A1, A2", cloze: ["A1", "A2", "B1", "B2"], wordBanks: ["A1", "A2"], clozeGaps: 11 },
    { name: "4 cloze A1-B2 + word banks A1, B2", cloze: ["A1", "A2", "B1", "B2"], wordBanks: ["A1", "B2"], clozeGaps: 11 },
    { name: "4 cloze A2-C1 + word banks A1, A2", cloze: ["A2", "B1", "B2", "C1"], wordBanks: ["A1", "A2"], clozeGaps: 11 },
    { name: "4 cloze A2-C1 + word banks A1, B1", cloze: ["A2", "B1", "B2", "C1"], wordBanks: ["A1", "B1"], clozeGaps: 11 },
    { name: "4 cloze A1, B1-C1 + word banks A1, A2", cloze: ["A1", "B1", "B2", "C1"], wordBanks: ["A1", "A2"], clozeGaps: 11 },
    { name: "3 cloze A2-B2 + word banks A1, B1, B2", cloze: ["A2", "B1", "B2"], wordBanks: ["A1", "B1", "B2"], clozeGaps: 11 },
    { name: "3 cloze A2-B2 + word banks A1, A2, B2", cloze: ["A2", "B1", "B2"], wordBanks: ["A1", "A2", "B2"], clozeGaps: 11 },
    { name: "4 cloze A1-B2 + word banks A1-B1", cloze: ["A1", "A2", "B1", "B2"], wordBanks: ["A1", "A2", "B1"], clozeGaps: 11 },
    { name: "5 cloze A1-C1 + word banks A1-B1", cloze: ["A1", "A2", "B1", "B2", "C1"], wordBanks: ["A1", "A2", "B1"], clozeGaps: 11 },
  ],
};

const RUNS = Number(process.env.RUNS ?? 4000);
const SEEDS = [2026, 7];
const ITEM_GUESS = Number(process.env.ITEM_GUESS ?? 0.25);
const options = (seed: number, clozeGaps = 11): SimulationOptions => ({
  runs: RUNS,
  seed,
  cTestGaps: 20,
  textEffectSd: 0.5,
  itemGuess: ITEM_GUESS,
  textGaps: { CLOZE: clozeGaps, WORDBANK: 8, OPEN: 10 },
  wordBankDistractors: 4,
});

const mcForm = (key: Key) =>
  key === "placement"
    ? withGrammar(key, section("GRAMMAR", 17, { distribution: per({ A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 }), cTest: true }))
    : withGrammar(key, section("GRAMMAR", 15, { distribution: per({ A1: 4, A2: 4, B1: 4, B2: 4, C1: 4, C2: 4 }), cTest: false }));
const cTestForm = (key: Key) =>
  key === "placement"
    ? withGrammar(key, section("GRAMMAR", 30, { distribution: per({}), cTestLevels: ALL }))
    : withGrammar(key, section("GRAMMAR", 15, { distribution: per({}), cTestLevels: ["A2", "B1", "B2"] }));
const textForm = (key: Key, c: Candidate) =>
  withGrammar(
    key,
    section("GRAMMAR", minutesFor(c.cloze.length, c.wordBanks.length, c.clozeGaps, c.open?.length ?? 0), { distribution: per({}), texts: textsOf(c.cloze, c.wordBanks, c.open) }),
  );

const pct = (x: number) => `${(x * 100).toFixed(1)}`;
const row = (name: string, a: FormAccuracy) =>
  `| ${name} | ${CEFR_LEVELS.map((l) => `${pct(a[l].exact)} / ${pct(a[l].withinOne)} / ${pct(a[l].over)}`).join(" | ")} |`;
const header = `| form | ${CEFR_LEVELS.join(" | ")} |\n|---|${CEFR_LEVELS.map(() => "---").join("|")}|`;

for (const key of ["placement", "quick-screen"] as const) {
  const chosen: string[] = [];
  for (const seed of SEEDS) {
    console.log(`\n## ${key}, seed ${seed}, ${RUNS} students per level, item guess ${ITEM_GUESS} (exact / within one / over, %)\n`);
    console.log(header);
    const mc = simulateFixedForm(mcForm(key), "PLACEMENT", options(seed));
    const cTest = simulateFixedForm(cTestForm(key), "PLACEMENT", options(seed));
    console.log(row("(a) multiple choice, before onSET", mc));
    console.log(row("(b) C-tests, today", cTest));
    const verdicts: string[] = [];
    for (const c of CANDIDATES[key]) {
      const form = textForm(key, c);
      const acc = simulateFixedForm(form, "PLACEMENT", options(seed, c.clozeGaps));
      const raw = simulateFixedForm(form, "PLACEMENT", { ...options(seed, c.clozeGaps), estimateGuess: false });
      const minutes = form.sections.find((s) => s.section === "GRAMMAR")!.durationMinutes;
      console.log(row(`(c) ${c.name}, ${minutes} min`, acc));
      console.log(row(`(c) same, estimate without the floor`, raw));
      const fails = gateFailures(mc, cTest, acc);
      verdicts.push(`- ${c.name}, ${minutes} min: ${fails.length ? `FAIL (${fails.join("; ")})` : "PASS"}`);
      if (!fails.length) chosen.push(`${seed}:${c.name}`);
    }
    console.log(`\nGate (A1-C1 exact >= (a) - 2, within one >= (a) - 1; A1 over <= (b) + 5):\n${verdicts.join("\n")}`);
  }
  const passesBoth = CANDIDATES[key].find((c) => SEEDS.every((seed) => chosen.includes(`${seed}:${c.name}`)));
  console.log(`\n${key}: ${passesBoth ? `first composition passing at both seeds: ${passesBoth.name}` : "no composition passes at both seeds"}`);
}

// Open cloze in the placement (spec 2026-10-23): (a) replaces the C1 and C2 cloze texts with open cloze texts
// in the same minutes; (b) adds open cloze at C1 and C2 to the earlier form. The gate is the one above. (a)
// passed at both seeds and is the placement template since 2026-10-23 (src/lib/exam/templates.ts).
const OPEN_TRIALS: Candidate[] = [
  { name: "(a) cloze A1-B2 + word banks A2-B2 + open C1, C2", cloze: ["A1", "A2", "B1", "B2"], wordBanks: ["A2", "B1", "B2"], open: ["C1", "C2"], clozeGaps: 11 },
  { name: "(b) 6 cloze A1-C2 + word banks A2-B2 + open C1, C2", cloze: ALL, wordBanks: ["A2", "B1", "B2"], open: ["C1", "C2"], clozeGaps: 11 },
];
const earlier: Candidate = CANDIDATES.placement[0];
const openPasses = new Map<string, number>();
for (const seed of SEEDS) {
  console.log(`\n## placement with open cloze, seed ${seed}, ${RUNS} students per level, item guess ${ITEM_GUESS} (exact / within one / over, %)\n`);
  console.log(header);
  const mc = simulateFixedForm(mcForm("placement"), "PLACEMENT", options(seed));
  const cTest = simulateFixedForm(cTestForm("placement"), "PLACEMENT", options(seed));
  console.log(row("(a) multiple choice, before onSET", mc));
  console.log(row("(b) C-tests", cTest));
  const verdicts: string[] = [];
  for (const c of [earlier, ...OPEN_TRIALS]) {
    const form = textForm("placement", c);
    const acc = simulateFixedForm(form, "PLACEMENT", options(seed, c.clozeGaps));
    const minutes = form.sections.find((s) => s.section === "GRAMMAR")!.durationMinutes;
    const name = c === earlier ? `until 2026-10-23: ${c.name}` : c.name;
    console.log(row(`${name}, ${minutes} min`, acc));
    const fails = gateFailures(mc, cTest, acc);
    verdicts.push(`- ${name}, ${minutes} min: ${fails.length ? `FAIL (${fails.join("; ")})` : "PASS"}`);
    if (!fails.length) openPasses.set(c.name, (openPasses.get(c.name) ?? 0) + 1);
  }
  console.log(`\nGate (A1-C1 exact >= (a) - 2, within one >= (a) - 1; A1 over <= (b) + 5):\n${verdicts.join("\n")}`);
}
for (const c of OPEN_TRIALS) console.log(`\nplacement ${c.name}: ${openPasses.get(c.name) === SEEDS.length ? "passes at both seeds" : "does not pass at both seeds"}`);
