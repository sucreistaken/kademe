/**
 * Calibration of the AI grader for writing and speaking.
 *
 * Runs every fixture of `src/lib/exam/grading-calibration` through the real
 * grading path (`gradeAnswer`, the function the grading job uses, so the same
 * prompt, repair attempt and checks) N times against the real model, without
 * any database write, and measures the proposals against the level a trained
 * rater gives each answer: exact agreement, within one level, bias per target
 * level, how often repeated runs disagree, flag precision and recall, every A0
 * fixture that was proposed above A0 and every proposal above the task cap.
 *
 * Run:   pnpm grading:calibrate -- --label round-1
 * Flags: --runs N (3)  --concurrency N (4)  --filter TEXT (fixture ids containing it)
 *        --label NAME (run)  --out DIR (docs/research/grading-calibration-2026-10-25)
 *        --temperature T  --seed N  --resume (keep finished runs of the same label)
 *        --table (print the round by round table from the saved reports and stop)
 * Needs GOOGLE_AI_API_KEY in .env (no key goes into any file). The provider is
 * pinned to Gemini on purpose: a silent fall back to another model would
 * measure a different grader.
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAiProvider } from "../src/lib/ai";
import { gradeAnswer, type GradeAnswerResult, type GradingJob } from "../src/lib/exam/grade-answer";
import { GRADING_CALL_OPTIONS, GRADING_JSON_SCHEMA, skillLevelFromCriteria } from "../src/lib/exam/grading";
import { CALIBRATION_FIXTURES } from "../src/lib/exam/grading-calibration/fixtures";
import {
  meetsGoals,
  summarize,
  levelDistance,
  type FixtureResult,
  type RunOutcome,
  type Summary,
} from "../src/lib/exam/grading-calibration/metrics";
import { resolveTask } from "../src/lib/exam/grading-calibration/tasks";
import { metricsFor } from "../src/lib/exam/grading-calibration/timing";
import type { CalibrationFixture } from "../src/lib/exam/grading-calibration/types";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string, fallback: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const RUNS = Number(value("runs", "3"));
const CONCURRENCY = Number(value("concurrency", "4"));
const FILTER = value("filter", "");
const LABEL = value("label", "run");
const OUT = value("out", "docs/research/grading-calibration-2026-10-25");
const TEMPERATURE = flag("temperature") ? Number(value("temperature", "")) : undefined;
const SEED = flag("seed") ? Number(value("seed", "")) : undefined;

// Pin Gemini before the provider is built.
delete process.env.NVIDIA_API_KEY;
delete process.env.OPENROUTER_API_KEY;
process.env.AI_PROVIDER = "gemini";

type Meta = {
  label: string;
  date: string;
  provider: string;
  model: string;
  runs: number;
  temperature: number | null;
  seed: number | null;
  fixtures: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
};
type Report = { meta: Meta; results: FixtureResult[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pct = (x: number | null) => (x === null ? "-" : `${(x * 100).toFixed(1)}%`);

function jobFor(fixture: CalibrationFixture): GradingJob {
  const task = resolveTask(fixture.task);
  const common = {
    task: task.prompt,
    contentPoints: task.contentPoints,
    register: task.register,
    taskLevel: task.taskLevel,
    rationaleLocale: "en" as const,
  };
  return task.section === "WRITING"
    ? { section: "WRITING", ...common, minWords: task.minWords!, maxWords: task.maxWords!, text: fixture.text }
    : {
        section: "SPEAKING",
        ...common,
        transcript: fixture.text,
        metrics: metricsFor(fixture.text, fixture.speech ?? "steady", fixture.id),
      };
}

function outcomeOf(result: GradeAnswerResult): RunOutcome {
  if (result.status === "EMPTY") {
    return { status: "EMPTY", level: null, overall: null, rawLevel: null, criteria: {}, flags: ["EMPTY"], rawFlags: [] };
  }
  if (result.status === "UNPARSEABLE") {
    return { status: "UNPARSEABLE", level: null, overall: null, rawLevel: null, criteria: {}, flags: [], rawFlags: [], error: result.error };
  }
  const criteria: RunOutcome["criteria"] = {};
  const rationales: NonNullable<RunOutcome["detail"]>["rationales"] = {};
  for (const c of result.proposal.criteria) {
    criteria[c.criterion] = c.level;
    rationales[c.criterion] = `${c.assessable ? "" : "(not assessable) "}${c.rationale}`;
  }
  return {
    status: "PROPOSED",
    level: result.level,
    overall: result.proposal.overallLevel,
    rawLevel: skillLevelFromCriteria(result.raw) ?? result.raw.overallLevel,
    criteria,
    flags: result.proposal.flags,
    rawFlags: result.raw.flags,
    detail: { summary: result.proposal.summary, rationales },
  };
}

function summaryLines(s: Summary): string[] {
  const bias = Object.entries(s.bias)
    .map(([level, b]) => `${level} ${b!.mean >= 0 ? "+" : ""}${b!.mean} (${b!.runs} runs)`)
    .join(", ");
  return [
    `fixtures ${s.fixtures}, runs ${s.runs}, graded ${s.graded}, unparseable ${s.unparseable}, errors ${s.errors}`,
    `exact ${pct(s.exact)}, within one ${pct(s.withinOne)}`,
    `repeated runs agree: pairwise ${pct(s.pairwise)}, fixtures with all runs equal ${pct(s.unanimous)}`,
    `A0 fixtures ${s.a0Fixtures}, not A0 in every run: ${s.a0Misses.length}${s.a0Misses.length ? ` (${s.a0Misses.join(", ")})` : ""}`,
    `above the task cap: final ${s.aboveCap}, raw model ${s.rawAboveCap}`,
    `mean signed bias by target level: ${bias}`,
    ...Object.entries(s.flags).map(
      (entry) => `flag ${entry[0]}: precision ${pct(entry[1]!.precision)}, recall ${pct(entry[1]!.recall)} (tp ${entry[1]!.tp}, fp ${entry[1]!.fp}, fn ${entry[1]!.fn})`,
    ),
    `diagnostics: ${JSON.stringify(s.diagnostics)}`,
  ];
}

function markdown(meta: Meta, results: FixtureResult[], s: Summary): string {
  const goals = meetsGoals(s);
  const lines: string[] = [];
  lines.push(`# Grading calibration: ${meta.label}`, "");
  lines.push(
    `Date ${meta.date}, provider ${meta.provider}, model ${meta.model}, ${meta.runs} runs per fixture, ${meta.fixtures} fixtures, temperature ${meta.temperature ?? "default"}, seed ${meta.seed ?? "none"}.`,
    "",
  );
  lines.push(
    `Goals (exact >= 70%, within one >= 95%, every A0 fixture A0 in every run, nothing above the task cap, repeated runs agree >= 90%): **${goals.ok ? "met" : `not met (${goals.misses.join("; ")})`}**.`,
    "",
  );
  lines.push("## Summary", "", ...summaryLines(s).map((l) => `- ${l}`), "");
  lines.push("## Per fixture", "", "| fixture | kind | target | runs: final level, [raw model level] | flags seen | |", "|---|---|---|---|---|---|");
  for (const r of results) {
    const shown = r.runs
      .map((x) => (x.status === "PROPOSED" ? `${x.level}${x.rawLevel !== x.level ? ` [${x.rawLevel}]` : ""}` : x.status))
      .join(", ");
    const seen = [...new Set(r.runs.flatMap((x) => x.flags))].join(" ") || "-";
    const off = r.runs.some((x) => x.level !== r.fixture.target);
    lines.push(`| ${r.fixture.id} | ${r.fixture.kind}${r.fixture.trap ? `/${r.fixture.trap}` : ""} | ${r.fixture.target} | ${shown} | ${seen} | ${off ? "differs" : ""} |`);
  }
  lines.push("", "## Misses in detail (a final level two or more away from the target, no level, or an A0 fixture above A0)", "");
  for (const r of results) {
    const bad = r.runs.filter(
      (x) => x.level === null || Math.abs(levelDistance(x.level, r.fixture.target)) >= 2 || (r.fixture.target === "A0" && x.level !== "A0"),
    );
    if (!bad.length) continue;
    lines.push(`### ${r.fixture.id} (target ${r.fixture.target})`, "");
    const x = bad[0];
    lines.push(`- level ${x.level ?? x.status}, raw ${x.rawLevel ?? "-"}, flags ${x.flags.join(" ") || "-"}${x.error ? `, error ${x.error}` : ""}`);
    if (x.detail) {
      lines.push(`- summary: ${x.detail.summary}`);
      for (const [c, text] of Object.entries(x.detail.rationales)) lines.push(`  - ${c} ${x.criteria[c as keyof typeof x.criteria]}: ${text}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function printTable() {
  const files = readdirSync(OUT).filter((f) => f.endsWith(".json")).sort();
  const rows = [
    "| round | model | runs | fixtures | exact | within one | A0 misses | above cap | runs agree (pairwise) | all runs equal | goals |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const file of files) {
    const data = JSON.parse(readFileSync(path.join(OUT, file), "utf8")) as Report;
    const s = summarize(data.results);
    rows.push(
      `| ${data.meta.label} | ${data.meta.model} | ${data.meta.runs} | ${s.fixtures} | ${pct(s.exact)} | ${pct(s.withinOne)} | ${s.a0Misses.length}/${s.a0Fixtures} | ${s.aboveCap} | ${pct(s.pairwise)} | ${pct(s.unanimous)} | ${meetsGoals(s).ok ? "met" : "not met"} |`,
    );
  }
  console.log(rows.join("\n"));
}

async function main() {
  if (flag("table")) {
    printTable();
    return;
  }

  const provider = getAiProvider();
  if (!provider.available) {
    console.log("NOT RUN: no AI provider configured (GOOGLE_AI_API_KEY).");
    process.exit(2);
  }
  console.log(`provider ${provider.name}, model ${provider.model}, runs ${RUNS}, concurrency ${CONCURRENCY}`);

  const fixtures = CALIBRATION_FIXTURES.filter((f) => f.id.includes(FILTER));
  mkdirSync(OUT, { recursive: true });
  const jsonPath = path.join(OUT, `${LABEL}.json`);
  const mdPath = path.join(OUT, `${LABEL}.md`);

  // Finished runs of an earlier, interrupted start of the same label.
  const done = new Map<string, RunOutcome[]>();
  if (flag("resume") && existsSync(jsonPath)) {
    const earlier = JSON.parse(readFileSync(jsonPath, "utf8")) as Report;
    for (const r of earlier.results) done.set(r.fixture.id, r.runs);
  }

  const options = {
    ...GRADING_CALL_OPTIONS,
    ...(TEMPERATURE !== undefined ? { temperature: TEMPERATURE } : {}),
    ...(SEED !== undefined ? { seed: SEED } : {}),
  };
  let calls = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  /** The model call: backs off on rate limits and overload, gives up after six tries. */
  const callModel = async (messages: Parameters<typeof provider.completeJson>[0]["messages"], run: number) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await provider.completeJson({
          messages,
          schemaName: "cefr_grading",
          jsonSchema: GRADING_JSON_SCHEMA,
          maxTokens: options.maxTokens,
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
          ...(options.seed !== undefined ? { seed: options.seed + run } : {}),
        });
        calls += 1;
        inputTokens += response.inputTokens ?? 0;
        outputTokens += response.outputTokens ?? 0;
        return { text: response.text, model: response.model, runId: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const transient = /429|503|500|overload|exhaust|network|timeout|fetch failed|did not answer|empty answer|cut off/i.test(message);
        if (!transient || attempt >= 5) throw error;
        const wait = Math.min(60_000, 2_000 * 2 ** attempt) + Math.round(Math.random() * 1_000);
        console.log(`  retry in ${Math.round(wait / 1000)} s: ${message.slice(0, 120)}`);
        await sleep(wait);
      }
    }
  };

  const slotsById = new Map<string, Array<RunOutcome | null>>();
  const tasks: Array<() => Promise<void>> = [];
  const meta = (): Meta => ({
    label: LABEL,
    date: new Date().toISOString().slice(0, 10),
    provider: provider.name,
    model: provider.model,
    runs: RUNS,
    temperature: TEMPERATURE ?? null,
    seed: SEED ?? null,
    fixtures: fixtures.length,
    modelCalls: calls,
    inputTokens,
    outputTokens,
  });
  const resultsNow = (): FixtureResult[] =>
    fixtures.map((fixture) => ({
      fixture: { id: fixture.id, task: fixture.task, kind: fixture.kind, target: fixture.target, trap: fixture.trap, flags: fixture.flags },
      taskLevel: resolveTask(fixture.task).taskLevel,
      runs: (slotsById.get(fixture.id) ?? []).filter((x): x is RunOutcome => !!x),
    }));
  const save = () => writeFileSync(jsonPath, JSON.stringify({ meta: meta(), results: resultsNow() }, null, 1));

  for (const fixture of fixtures) {
    const slots: Array<RunOutcome | null> = Array.from({ length: RUNS }, (_, i) => done.get(fixture.id)?.[i] ?? null);
    slotsById.set(fixture.id, slots);
    for (let run = 0; run < RUNS; run++) {
      if (slots[run]) continue;
      tasks.push(async () => {
        let outcome: RunOutcome;
        try {
          outcome = outcomeOf(await gradeAnswer(jobFor(fixture), (messages) => callModel(messages, run)));
        } catch (error) {
          outcome = {
            status: "ERROR",
            level: null,
            overall: null,
            rawLevel: null,
            criteria: {},
            flags: [],
            rawFlags: [],
            error: error instanceof Error ? error.message : String(error),
          };
        }
        slots[run] = outcome;
        const shown = outcome.status === "PROPOSED" ? `${outcome.level} (raw ${outcome.rawLevel})` : `${outcome.status}${outcome.error ? ` ${outcome.error.slice(0, 80)}` : ""}`;
        console.log(`${fixture.id} run ${run + 1}: ${shown}, target ${fixture.target}`);
        save();
      });
    }
  }

  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await tasks[next++]();
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  save();

  const results = resultsNow();
  const summary = summarize(results);
  writeFileSync(mdPath, markdown(meta(), results, summary));
  console.log(`\n${summaryLines(summary).join("\n")}`);
  console.log(`\nSaved ${jsonPath} and ${mdPath}. Model calls ${calls}, tokens in ${inputTokens}, out ${outputTokens}.`);
  const goals = meetsGoals(summary);
  console.log(goals.ok ? "GOALS MET" : `GOALS NOT MET: ${goals.misses.join("; ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
