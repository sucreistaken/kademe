/**
 * Gate for the onSET-style placement (spec 2026-10-15, section 7 and 8):
 * today's forms against the C-test forms, same simulated students.
 * Run: pnpm tsx scripts/simulate-placement.ts
 */
import { section, type BlueprintConfig, type SectionConfig } from "@/lib/exam/blueprint";
import { simulateFixedForm, type FormAccuracy } from "@/lib/exam/form-simulation";
import { examTemplateByKey } from "@/lib/exam/templates";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";

const per = (counts: Partial<Record<Cefr, number>>) => ({
  kind: "ABSOLUTE" as const,
  perLevel: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, ...counts },
});
const withGrammar = (key: "placement" | "quick-screen", grammar: SectionConfig): BlueprintConfig => {
  const cfg = structuredClone(examTemplateByKey(key)!.config);
  cfg.sections = cfg.sections.map((s) => (s.section === "GRAMMAR" ? grammar : s));
  return cfg;
};

const RUNS = 4000;
const base = { runs: RUNS, seed: 2026, cTestGaps: 20, textEffectSd: 0.5 };
const forms = {
  placementBefore: [withGrammar("placement", section("GRAMMAR", 17, { distribution: per({ A1: 3, A2: 3, B1: 3, B2: 3, C1: 3, C2: 3 }), cTest: true })), 1],
  placementAfter: [withGrammar("placement", section("GRAMMAR", 30, { distribution: per({}), cTestLevels: [...CEFR_LEVELS] })), 5],
  quickBefore: [withGrammar("quick-screen", section("GRAMMAR", 15, { distribution: per({ A1: 4, A2: 4, B1: 4, B2: 4, C1: 4, C2: 4 }), cTest: false })), 1],
  quickAfter: [withGrammar("quick-screen", section("GRAMMAR", 15, { distribution: per({}), cTestLevels: ["A2", "B1", "B2"] })), 5],
} as const;

const results = Object.fromEntries(
  Object.entries(forms).map(([name, [cfg, weight]]) => [name, simulateFixedForm(cfg, "PLACEMENT", { ...base, cTestWeight: weight })]),
) as Record<keyof typeof forms, FormAccuracy>;

const pct = (x: number) => `${Math.round(x * 100)}%`;
for (const [name, acc] of Object.entries(results)) {
  console.log(name.padEnd(16), CEFR_LEVELS.map((l) => `${l} ${pct(acc[l].exact)}/${pct(acc[l].withinOne)}`).join("  "));
}

const gate = (before: FormAccuracy, after: FormAccuracy) =>
  (["A1", "A2", "B1", "B2", "C1"] as Cefr[]).every(
    (l) => after[l].exact >= before[l].exact - 0.02 && after[l].withinOne >= before[l].withinOne - 0.01,
  );
console.log(`placement gate: ${gate(results.placementBefore, results.placementAfter) ? "PASS" : "FAIL"}`);
console.log(`quick-screen gate: ${gate(results.quickBefore, results.quickAfter) ? "PASS" : "FAIL"}`);
