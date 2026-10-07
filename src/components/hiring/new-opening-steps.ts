import type { CreateOpeningActionResult } from "@/app/(manager)/hiring/openings/new/actions";
import { flowJourney, flowStepOf, stepOfProblem, type FlowJourney } from "@/components/manager/flow-model";
import type { StartValue } from "./start-choices";

/**
 * HIRING-UX 5.20: "Alım aç" to publish is one wizard of three steps (Rolü
 * anlat, Sorular, Önizle ve yayınla). Step 1 lives on /hiring/openings/new;
 * steps 2 and 3 on the opening's /setup page. Every screen counts against this
 * one path, so the footer always says "Adım n / 3".
 */
export const WIZARD_PATH = ["role", "questions", "publish"] as const;
export type WizardStep = (typeof WIZARD_PATH)[number];

/** "Adım n / 3" for a wizard screen; a side screen of step 1 (template gallery, copy picker) counts as step 1. */
export function wizardJourney(step: WizardStep | "template" | "copy"): FlowJourney {
  return flowJourney<string>(WIZARD_PATH, step, "role");
}

/**
 * Step 1's screens, in the address's hash: the role screen, and the two
 * alternative starts that need a choice first (the template gallery, the
 * opening to copy from; the latter only when there is one). "Soruları kendim
 * yazacağım" needs no choice, so it has no screen of its own.
 */
export type NewOpeningStep = "role" | "template" | "copy";
/** Every refusal createOpeningAction can answer (the server's and the action's INVALID, FAILED). */
export type NewOpeningRefusal = Extract<CreateOpeningActionResult, { ok: false }>["code"];

export function newOpeningSteps(input: { hasCopySources: boolean }): NewOpeningStep[] {
  return input.hasCopySources ? ["role", "template", "copy"] : ["role", "template"];
}

/** W3: the hash's screen; an unknown hash opens the role screen. The side screens never wait on the role. */
export function newOpeningStepOf(hash: string, steps: readonly NewOpeningStep[]): NewOpeningStep {
  return flowStepOf(hash, { steps, firstInvalid: null });
}

const REFUSAL_STEP: Record<NewOpeningRefusal, NewOpeningStep> = {
  POSITION_NAME_REQUIRED: "role",
  POSITION_NOT_FOUND: "role",
  JOB_AD_REQUIRED: "role",
  COPY_SOURCE_NOT_FOUND: "copy",
  TEMPLATE_NOT_FOUND: "template",
  INVALID: "role",
  FAILED: "role",
};

/** W8: a refusal of createOpeningAction opens the screen it is about, with its sentence there. */
export const newOpeningStepOfRefusal = (code: NewOpeningRefusal): NewOpeningStep => stepOfProblem(REFUSAL_STEP, code) ?? "role";

/** One question the AI asked about the role (clarifyRoleAction's shape). */
export type RoleQuestion = { key: string; text: string; options: string[]; allowFree: boolean };
/** One answered round, as clarifyRoleAction takes it back. */
export type RoleRound = { questions: RoleQuestion[]; answers: Record<string, string> };

/** The server's cap (role-brief.ts ROLE_BRIEF_MAX_ROUNDS): with this many rounds the AI must write the brief. */
export const ROLE_MAX_ROUNDS = 6;

/**
 * What the manager answered on one card: a chip, or their own words under
 * "Başka" (own words win when both are given). Empty answers are left out, so
 * the AI reads "(cevapsız)" for them.
 */
export function answersOf(questions: readonly RoleQuestion[], picked: Record<string, string>, typed: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of questions) {
    const own = (typed[q.key] ?? "").trim();
    const chip = (picked[q.key] ?? "").trim();
    const value = own || chip;
    if (value) out[q.key] = value;
  }
  return out;
}

/**
 * "Bu kadar yeter, devam et": the AI is told to stop asking by the server's
 * own rule (a brief is due once ROLE_MAX_ROUNDS rounds are in), so the rounds
 * are filled up with empty ones. Nothing the manager answered is dropped.
 */
export function roundsToFinish(rounds: readonly RoleRound[]): RoleRound[] {
  const out = [...rounds];
  while (out.length < ROLE_MAX_ROUNDS) out.push({ questions: [], answers: {} });
  return out;
}

/**
 * The job ad the new position gets on the AI start: the brief's ad, and when
 * the manager corrected the summary, the corrected bullets under it, so the
 * questions are drafted from what they confirmed.
 */
export function jobDescriptionOf(brief: { summary: readonly string[]; jobAd: string }, summary: readonly string[], max: number): string {
  const kept = summary.map((s) => s.trim()).filter(Boolean);
  const changed = kept.length !== brief.summary.length || kept.some((s, i) => s !== brief.summary[i]);
  const text = changed && kept.length ? `${brief.jobAd.trim()}\n\n${kept.map((s) => `- ${s}`).join("\n")}` : brief.jobAd.trim();
  return text.slice(0, max);
}

/** The refusal codes of clarifyRoleAction, each with its sentence (hiringWizard.*). */
export type ClarifyCode = "INVALID" | "RATE_LIMITED" | "UNCONFIGURED" | "FAILED" | "FORBIDDEN";
export const CLARIFY_COPY: Record<ClarifyCode | "NETWORK", "aiInvalid" | "aiRateLimited" | "aiUnconfigured" | "aiFailed" | "aiForbidden"> = {
  INVALID: "aiInvalid",
  RATE_LIMITED: "aiRateLimited",
  UNCONFIGURED: "aiUnconfigured",
  FAILED: "aiFailed",
  FORBIDDEN: "aiForbidden",
  NETWORK: "aiFailed",
};

/** Manager mockup 3: above this many library positions only the ones matching the typed name are offered. */
export const POSITION_SUGGESTIONS = 6;

const fold = (text: string) => text.trim().toLocaleLowerCase("tr");

/**
 * The old picker's rule, kept: a typed name that is a library position's name
 * (any case, outer spaces ignored) is that position, so no second position of
 * the same name is opened.
 */
export function matchPosition<P extends { id: string; name: string }>(list: readonly P[], name: string): P | null {
  const wanted = fold(name);
  if (!wanted) return null;
  return list.find((p) => fold(p.name) === wanted) ?? null;
}

/**
 * matchTemplate's rule (solutions/hiring/templates) on the gallery's cards: a
 * position whose name is a template's TR or EN name, any case, outer spaces
 * ignored, preselects that template.
 */
export function templateForPosition<T extends { key: string; names: readonly string[] }>(list: readonly T[], positionName: string): T | null {
  const wanted = fold(positionName);
  if (!wanted) return null;
  return list.find((x) => x.names.some((n) => fold(n) === wanted)) ?? null;
}

/** The library positions offered under the name field: those containing the typed text, at most POSITION_SUGGESTIONS. */
export function suggestedPositions<P extends { id: string; name: string }>(list: readonly P[], typed: string): P[] {
  const q = fold(typed);
  const hits = q ? list.filter((p) => fold(p.name).includes(q) && fold(p.name) !== q) : [...list];
  return hits.slice(0, POSITION_SUGGESTIONS);
}

/** The start a wizard path sends to createOpeningAction. */
export type WizardStart = Extract<StartValue, "AI" | "TEMPLATE" | "COPY" | "BLANK">;

/**
 * Where step 2 opens after createOpeningAction: its `next`, and on the AI
 * start `?draft=ai`, which tells step 2 to write the questions at once. Other
 * starts never get a draft written over what they chose.
 */
export function afterCreate(next: string, start: WizardStart): string {
  if (start !== "AI") return next;
  const at = next.indexOf("#");
  const path = at < 0 ? next : next.slice(0, at);
  const hash = at < 0 ? "" : next.slice(at);
  return `${path}${path.includes("?") ? "&" : "?"}draft=ai${hash}`;
}
