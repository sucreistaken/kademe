import { stepOfProblem } from "@/components/manager/flow-model";
import { canDecide } from "@/solutions/hiring/rules/access";
import { openingRulesProblems, type OpeningRulesInput, type PanelUser, type RulesProblem } from "@/solutions/hiring/rules/opening-rules";

/**
 * HIRING-VISUAL-FLOW 4.10 (H2, H5, D10, W1-W8): team and rules as a read-only
 * summary and four short flows, each step in the hash on the same page (D13).
 * Every flow saves through the one existing action with every field: the
 * fields outside the flow go back as loaded, so a flow changes only its own.
 */
export type RulesFlow = "team" | "contact" | "fair" | "name";
export type RulesStep =
  | "team-members"
  | "team-decider"
  | "team-review"
  | "contact-deadline"
  | "contact-feedback"
  | "contact-email"
  | "contact-review"
  | "fair-blind"
  | "fair-survey"
  | "fair-review"
  | "name";
type Field = keyof OpeningRulesInput;

export const RULES_FLOWS: Record<RulesFlow, readonly RulesStep[]> = {
  team: ["team-members", "team-decider", "team-review"],
  contact: ["contact-deadline", "contact-feedback", "contact-email", "contact-review"],
  fair: ["fair-blind", "fair-survey", "fair-review"],
  name: ["name"],
};

/** The step that ends each flow with its one "Kaydet" (the name is one step, H2). */
export const REVIEW_STEP: Record<RulesFlow, RulesStep> = { team: "team-review", contact: "contact-review", fair: "fair-review", name: "name" };

/** The fields each flow decides (its summary's rows and what it may change). */
export const FLOW_FIELDS: Record<RulesFlow, readonly Field[]> = {
  team: ["memberIds", "decisionMakerId", "backupDecisionMakerId"],
  contact: ["deadline", "feedbackDays", "candidateContactEmail"],
  fair: ["blindMode", "finishSurveyEnabled"],
  name: ["name"],
};

/** W8: every problem the rules (and the server) can name, on the step that fixes it. */
const PROBLEM_STEP: Record<RulesProblem, RulesStep> = {
  NAME_REQUIRED: "name",
  MEMBER_UNKNOWN: "team-members",
  DECISION_MAKER_REQUIRED: "team-decider",
  DECISION_MAKER_ROLE: "team-decider",
  BACKUP_SAME: "team-decider",
  BACKUP_ROLE: "team-decider",
  DEADLINE_INVALID: "contact-deadline",
  DEADLINE_PAST: "contact-deadline",
  FEEDBACK_DAYS: "contact-feedback",
  EMAIL: "contact-email",
};

export const rulesStepOf = (problem: RulesProblem): RulesStep => stepOfProblem(PROBLEM_STEP, problem) ?? "name";

const FLOWS = Object.keys(RULES_FLOWS) as RulesFlow[];
const ALL_STEPS = FLOWS.flatMap((flow) => RULES_FLOWS[flow]);

/** The flow a step belongs to. */
export const flowOfStep = (step: RulesStep): RulesFlow => FLOWS.find((flow) => RULES_FLOWS[flow].includes(step)) ?? "name";

/** W3: the address's hash as a flow and its step; any other hash is the summary (null). */
export function rulesRoute(hash: string): { flow: RulesFlow; step: RulesStep } | null {
  const step = ALL_STEPS.find((s) => `#${s}` === hash);
  return step ? { flow: flowOfStep(step), step } : null;
}

/**
 * The path useFlowStep walks for a flow: the summary (no hash) before the
 * flow's steps. On this page no hash means the summary, so the flow's first
 * step keeps its hash (`#team-members`, `#contact-deadline`): flowHashFix
 * clears the hash only on the path's first entry, which is this one.
 */
export const RULES_ENTRY = "summary";
export const rulesPath = (flow: RulesFlow): ReadonlyArray<RulesStep | typeof RULES_ENTRY> => [RULES_ENTRY, ...RULES_FLOWS[flow]];

/**
 * Who reads the hash. Only an open flow keeps its step in the address (hash
 * mode); the summary, a reviewer's page and a closed opening keep the flow's
 * step in memory, so useFlowStep never rewrites an address it does not own
 * (Task 19 carry: in hash mode it clears any hash that is not a step of the
 * path). The summary opens a flow by pushing that flow's first step.
 */
export const rulesNavMode = (route: { flow: RulesFlow } | null): "hash" | "memory" => (route ? "hash" : "memory");

type Check = { users: PanelUser[]; today: string; savedDeadline: string | null };

/** W8: the first problem of the rules that this step fixes, or null ("Devam et" goes on). */
export function stepWait(step: RulesStep, value: OpeningRulesInput, check: Check): RulesProblem | null {
  return openingRulesProblems(value, check.users, check.today, check.savedDeadline).find((p) => PROBLEM_STEP[p] === step) ?? null;
}

/** W3: the first step of the flow that waits; a link past it opens it. */
export function firstInvalidStep(flow: RulesFlow, value: OpeningRulesInput, check: Check): RulesStep | null {
  return RULES_FLOWS[flow].find((step) => stepWait(step, value, check) !== null) ?? null;
}

/** D10: what a flow sends: its own fields as chosen, every other field as loaded. */
export function saveInput(saved: OpeningRulesInput, value: OpeningRulesInput, flow: RulesFlow): OpeningRulesInput {
  const out: OpeningRulesInput = { ...saved };
  for (const field of FLOW_FIELDS[flow]) Object.assign(out, { [field]: value[field] });
  return out;
}

/**
 * The first problem of a whole save that lives in another flow (a saved
 * decision maker who left, while the contact flow is open): the save waits
 * with its sentence and offers that flow's step (D10's cost, Part 2
 * pre-flight). Problems of this flow are its own steps' waits.
 */
export function otherFlowProblem(problems: readonly RulesProblem[], flow: RulesFlow): RulesProblem | null {
  return problems.find((p) => !RULES_FLOWS[flow].includes(PROBLEM_STEP[p])) ?? null;
}

type Person = { id: string; name: string; role: PanelUser["role"]; disabled: boolean };

/**
 * The team in one line, counted and named as the overview's publish summary
 * and rules card count and name it (Task 20): the members who are active
 * users counted (setupRowsOf counts the same people, and its team step is
 * also not done while a member is disabled, B-M1; this line only counts), the
 * decider named only while active and able to decide (null otherwise: "kimse
 * seçilmedi"), the backup the same way.
 */
export function teamLine(saved: Pick<OpeningRulesInput, "memberIds" | "decisionMakerId" | "backupDecisionMakerId">, users: readonly Person[]) {
  const deciding = (id: string | null) => users.find((u) => u.id === id && !u.disabled && canDecide(u.role)) ?? null;
  return {
    count: saved.memberIds.filter((id) => users.some((u) => u.id === id && !u.disabled)).length,
    decider: deciding(saved.decisionMakerId)?.name ?? null,
    backup: deciding(saved.backupDecisionMakerId)?.name ?? null,
  };
}

/** Every field of the rules: an edit in any flow that is not saved yet makes leaving lose it. */
export const ALL_FIELDS: readonly Field[] = FLOWS.flatMap((flow) => FLOW_FIELDS[flow]);

/**
 * After a flow's save. `origin` is the flow a cross-flow "Değiştir" came from
 * (the contact flow waited on a decider who left, so the team flow opened).
 * With it, the origin's pending edits stay (the saved flow's fields as
 * stored, every other field as the user left it) and its summary step opens
 * again, so its own "Kaydet" can now go through; without it, the values are
 * what was stored and the page goes back to the rules' summary (no hash).
 */
export function afterSave(input: { flow: RulesFlow; origin: RulesFlow | null; stored: OpeningRulesInput; value: OpeningRulesInput }): { value: OpeningRulesInput; hash: string | null } {
  if (input.origin === null || input.origin === input.flow) return { value: input.stored, hash: null };
  return { value: saveInput(input.value, input.stored, input.flow), hash: `#${REVIEW_STEP[input.origin]}` };
}

export type SavedNotePart = { key: "saved" } | { key: "savedRenamed"; name: string } | { key: "savedOther"; flow: RulesFlow };

/**
 * What the review step says after a save. A save that brought the user back
 * to the flow waiting on it (I1) names the flow it saved, so "Kaydedildi."
 * is never read as this flow's change being saved; a numbered name is said
 * either way.
 */
export function savedNote(notice: { of: RulesFlow; renamed: string | null }, shown: RulesFlow): SavedNotePart[] {
  const parts: SavedNotePart[] = [];
  if (notice.renamed) parts.push({ key: "savedRenamed", name: notice.renamed });
  if (notice.of !== shown) parts.push({ key: "savedOther", flow: notice.of });
  else if (!notice.renamed) parts.push({ key: "saved" });
  return parts;
}
