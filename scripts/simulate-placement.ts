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
 * A0 (Pre-A1, 2026-10-24): the placed level is the result level, so a pooled
 * mean below the A1 band is A0. Every table has an A0 column (students spread
 * over the logit below the A1 band, simulated after C2 so the A1 to C2 draws
 * are the earlier ones), and a last table runs the live templates by the
 * engine's overall rule with the chance rule (chance.ts), for students who guess
 * and students who leave what they do not know blank, on the placement, the
 * quick screen and the level check (A1 and A2 claims), against the targets of
 * 2026-10-24.
 * Run: pnpm tsx scripts/simulate-placement.ts   (RUNS=1000 for a quick look;
 * ITEM_GUESS=0 to let ordinary items be answered without guessing).
 */
import { section, type BlueprintConfig, type SectionConfig } from "@/lib/exam/blueprint";
import { gateFailures, simulateFixedForm, type FormAccuracy, type SimulationOptions } from "@/lib/exam/form-simulation";
import { examTemplateByKey } from "@/lib/exam/templates";
import { BAND_CENTER } from "@/lib/exam/cefr";
import { CEFR_LEVELS, RESULT_LEVELS, type Cefr } from "@/lib/exam/types";

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
  trueLevels: [...CEFR_LEVELS, "A0"],
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
const cell = (a: FormAccuracy[Cefr] | undefined) => (a ? `${pct(a.exact)} / ${pct(a.withinOne)} / ${pct(a.over)}` : "-");
const COLUMNS = [...CEFR_LEVELS, "A0"] as const;
const row = (name: string, a: FormAccuracy) => `| ${name} | ${COLUMNS.map((l) => cell(a[l])).join(" | ")} |`;
const header = `| form | ${COLUMNS.join(" | ")} |\n|---|${COLUMNS.map(() => "---").join("|")}|`;

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

// A0 (Pre-A1), 2026-10-24: the live templates as they are (src/lib/exam/templates.ts), placed by the engine's own
// computeResult: each objective section with its chance test (src/lib/exam/chance.ts, live settings), writing and
// speaking at the student's true level (a grader who is right: A0 for no German, A1 for A1, the claim for the claimed
// band centre) or left out ("objective only"), the template's pass rules and the claim. Two behaviours: "guess"
// answers everything (ordinary items with the floor above, gaps with their text floor), "blank" answers only what
// the student knows and leaves the rest blank. True ability: no German at all (theta -8), A1 band centre (-2.5), the
// A1 band, and for a verification the claimed band centre. Targets (controller, 2026-10-24): no German -> A0 at least
// 90%, A1 centre and A1 band false A0 at most 3%; false FAIL at the claimed band centre is reported, with the same
// figure without the chance rule for comparison.
const NO_GERMAN = -8;
const pctOf = (x: number | undefined) => (x === undefined ? "-" : pct(x));
const liveHeader =
  "| template, writing and speaking, behaviour | no German: A0 | no German: FAIL | A1 centre: false A0 | A1 band: false A0 | claim centre: FAIL | same, no chance rule |\n|---|---|---|---|---|---|---|";
type LiveRow = { key: "placement" | "quick-screen" | "level-check"; productive: "TRUE" | "NONE"; claimed?: Cefr };
const LIVE: LiveRow[] = [
  { key: "placement", productive: "TRUE" },
  { key: "placement", productive: "NONE" },
  { key: "quick-screen", productive: "NONE" },
  { key: "level-check", productive: "TRUE", claimed: "A1" },
  { key: "level-check", productive: "TRUE", claimed: "A2" },
];
const targets: string[] = [];
for (const seed of SEEDS) {
  console.log(`\n## A0 (Pre-A1) by the overall rule on the live templates, seed ${seed}, ${RUNS} students per cell (%)\n`);
  console.log(liveHeader);
  for (const row of LIVE) {
    const config = examTemplateByKey(row.key)!.config;
    const mode = row.claimed ? "LEVEL_VERIFICATION" : "PLACEMENT";
    const label = `${row.key}${row.claimed ? ` claim ${row.claimed}` : ""}, ${row.key === "quick-screen" ? "none in the template" : row.productive === "TRUE" ? "at the true level" : "objective only"}`;
    for (const behaviour of ["GUESS", "BLANK"] as const) {
      const o = { ...options(seed), itemGuess: ITEM_GUESS, behaviour, claimed: row.claimed, overall: { productive: row.productive, chance: {} } };
      const none = simulateFixedForm(config, mode, { ...o, trueLevels: ["A0"], fixedTheta: NO_GERMAN }).A0!;
      const centre = simulateFixedForm(config, mode, { ...o, trueLevels: ["A1"], fixedTheta: BAND_CENTER.A1 }).A1;
      const band = simulateFixedForm(config, mode, { ...o, trueLevels: ["A1"] }).A1;
      const claimCentre = row.claimed ? simulateFixedForm(config, mode, { ...o, trueLevels: [row.claimed], fixedTheta: BAND_CENTER[row.claimed] })[row.claimed] : undefined;
      const claimNoRule = row.claimed
        ? simulateFixedForm(config, mode, { ...o, overall: { productive: row.productive, chance: null }, trueLevels: [row.claimed], fixedTheta: BAND_CENTER[row.claimed] })[row.claimed]
        : undefined;
      console.log(
        `| ${label}, ${behaviour.toLowerCase()} | ${pct(none.a0)} | ${row.claimed ? pct(none.fail) : "-"} | ${pct(centre.a0)} | ${pct(band.a0)} | ${pctOf(claimCentre?.fail)} | ${pctOf(claimNoRule?.fail)} |`,
      );
      if (row.productive === "TRUE" || row.key === "quick-screen") {
        const ok = none.a0 >= 0.9 && centre.a0 <= 0.03 && band.a0 <= 0.03;
        targets.push(`- seed ${seed}, ${label}, ${behaviour.toLowerCase()}: no German ${pct(none.a0)}% A0, A1 centre ${pct(centre.a0)}%, A1 band ${pct(band.a0)}% false A0: ${ok ? "meets" : "MISSES"} the targets`);
      }
    }
  }
}
console.log(`\nTargets (no German -> A0 >= 90%, A1 centre and A1 band false A0 <= 3%):\n${targets.join("\n")}`);
console.log(`\nResult levels: ${RESULT_LEVELS.join(", ")}; for A0 "exact" is placed A0, "within one" A0 or A1.`);
