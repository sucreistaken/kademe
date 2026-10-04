import type { HiringResponsePayload } from "@/db/schema";
import type { I18nText } from "@/db/schema/types";
import { effectiveSeconds, hiringStepSuffix, responseAnswered, stageRules, type ExtraTimePct, type HiringStep, type StageRule } from "./candidate-flow";
import { toCandidateVersion, type CandidateStage } from "./candidate-view";
import { orderedActivities, orderedStages, type ContentStage } from "./content";
import { devicesNeeded, estimatedMinutes, recordedSignals, type RecordedSignal } from "./disclosure";

/**
 * Everything a hiring candidate's screens are built from (hiring solution
 * design 7). The ONLY source of question and stage text is
 * toCandidateVersion: the team-only fields never enter this object. The rest is
 * the candidate's own data. Field names avoid every name candidateSafe strips,
 * so the last-line filter changes nothing (a test proves it).
 */

export type CandidateResponseView = {
  activityId: string;
  text: string;
  choiceIds: string[];
  usedTextAlternative: boolean;
  takesUsed: number;
  /** The newest usable take; `ref` is the candidate's own upload reference (for playback). */
  recording: { ref: string; status: "UPLOADING" | "READY" | "INCOMPLETE"; durationMs: number | null } | null;
  file: { name: string; bytes: number } | null;
  answered: boolean;
  /** The candidate already closed this question (moved on). */
  closed: boolean;
};

export type CurrentStage = {
  position: number;
  total: number;
  stage: CandidateStage;
  /** Seconds on this candidate's clock (extra time included, grace not). */
  seconds: number;
  startedAt: string | null;
  deadlineAt: string | null;
  serverNow: string;
  remainingMs: number | null;
  backNavigation: boolean;
  /** Extra seconds after the clock reaches 0 (only an ALLOW_GRACE stage; already inside deadlineAt and remainingMs). */
  graceSeconds: number;
  /** The client submits when the clock reaches 0 (every timeout rule but ALLOW_LATE). */
  autoSubmit: boolean;
  rules: StageRule[];
  responses: CandidateResponseView[];
  /** The stage just before this one, for "Aşama 1 tamamlandı" or "Süre doldu" (HIRING-UX 6.10, 6.11). */
  previous: { position: number; closedByClock: boolean } | null;
  last: boolean;
};

export type HiringCandidateState = {
  step: HiringStep;
  position: number | null;
  /** The page this state lives on, relative to /a/[token] (rules/candidate-flow hiringStepSuffix). */
  path: string;
  orgName: string;
  positionName: string;
  candidateName: string | null;
  intro: { title: I18nText | null; body: I18nText | null };
  stages: Array<{ position: number; name: I18nText; minutes: number; graceSeconds: number; questions: number; done: boolean }>;
  totalMinutes: number;
  reviewers: number;
  signals: RecordedSignal[];
  devices: { camera: boolean; microphone: boolean };
  extraTimePct: ExtraTimePct;
  extraTimeLocked: boolean;
  practice: boolean;
  contactEmail: string | null;
  retention: { mediaDays: number; candidateDays: number };
  current: CurrentStage | null;
  /** `feedbackBy`: the dated promise on the finish screen (completion + the opening's feedback days). */
  finished: { completedAt: string; stagesDone: number; feedbackBy: string; survey: { enabled: boolean; answered: boolean } } | null;
};

export type StateInput = {
  now: Date;
  orgName: string;
  contactEmail: string | null;
  retention: { mediaDays: number; candidateDays: number };
  opening: { status: "DRAFT" | "OPEN" | "CLOSED"; positionName: string; finishSurveyEnabled: boolean; feedbackDays: number };
  version: { stages: ContentStage[]; introTitle: I18nText | null; introBody: I18nText | null; practiceEnabled: boolean };
  invitation: {
    candidateName: string | null;
    candidateEmail: string | null;
    extraTimePct: ExtraTimePct;
    reviewers: number;
    consented: boolean;
    deviceChecked: boolean;
    /** A stage of this attempt has started. */
    started: boolean;
    completedAt: Date | null;
    surveyAnswered: boolean;
  };
  runs: Array<{ stageId: string; startedAt: Date | null; deadlineAt: Date | null; submittedAt: Date | null; wasLate: boolean }>;
  responses: Array<{
    stageId: string;
    activityId: string;
    payload: HiringResponsePayload;
    takesUsed: number;
    answeredAt: Date | null;
    recording: { ref: string; status: "UPLOADING" | "READY" | "INCOMPLETE" | "FAILED"; durationMs: number | null } | null;
  }>;
};

export function buildCandidateState(input: StateInput): HiringCandidateState {
  const view = toCandidateVersion({ stages: input.version.stages });
  const content = orderedStages({ stages: input.version.stages });
  const pct = input.invitation.extraTimePct;
  const runOf = (stageId: string) => input.runs.find((r) => r.stageId === stageId) ?? null;
  const devices = devicesNeeded(view);
  // C25: the grace a stage grants, by stage id (0 unless its timeout rule is ALLOW_GRACE).
  const graceOf = (stage: ContentStage): number => (stage.onTimeout === "ALLOW_GRACE" ? Math.max(0, stage.graceSeconds) : 0);
  const graceByStage = Object.fromEntries(content.map((s) => [s.id, graceOf(s)]));
  const inv = input.invitation;

  const openIndex = view.stages.findIndex((s) => !runOf(s.id)?.submittedAt);
  let step: HiringStep;
  if (inv.completedAt) step = "DONE";
  else if (input.opening.status === "CLOSED" && !inv.started) step = "CLOSED";
  else if (!inv.consented) step = "CONSENT";
  else if (!inv.candidateName || !inv.candidateEmail) step = "INFO";
  else if (devices.microphone && !inv.deviceChecked) step = "CHECK";
  else step = openIndex === -1 ? "DONE" : "STAGE";
  const position = step === "STAGE" ? openIndex + 1 : null;

  let current: CurrentStage | null = null;
  if (step === "STAGE") {
    const stageView = view.stages[openIndex];
    const stageContent = content[openIndex];
    const run = runOf(stageView.id);
    const deadline = run?.deadlineAt ?? null;
    const before = openIndex > 0 ? runOf(view.stages[openIndex - 1].id) : null;
    current = {
      position: openIndex + 1,
      total: view.stages.length,
      stage: stageView,
      seconds: effectiveSeconds(stageView.durationSeconds, pct),
      startedAt: run?.startedAt?.toISOString() ?? null,
      deadlineAt: deadline?.toISOString() ?? null,
      serverNow: input.now.toISOString(),
      remainingMs: deadline ? Math.max(0, deadline.getTime() - input.now.getTime()) : null,
      graceSeconds: graceOf(stageContent),
      backNavigation: stageContent.backNavigation,
      autoSubmit: stageContent.onTimeout !== "ALLOW_LATE",
      rules: stageRules(stageView, { backNavigation: stageContent.backNavigation, onTimeout: stageContent.onTimeout }),
      responses: orderedActivities(stageContent).map((activity): CandidateResponseView => {
        const row = input.responses.find((r) => r.stageId === stageContent.id && r.activityId === activity.id);
        const payload = row?.payload ?? {};
        const take = row?.recording && row.recording.status !== "FAILED" ? { ref: row.recording.ref, status: row.recording.status, durationMs: row.recording.durationMs } : null;
        return {
          activityId: activity.id,
          text: payload.text ?? "",
          choiceIds: payload.choiceIds ?? [],
          usedTextAlternative: !!payload.usedTextAlternative,
          takesUsed: row?.takesUsed ?? 0,
          recording: take,
          file: payload.file ? { name: payload.file.name, bytes: payload.file.bytes } : null,
          answered: responseAnswered(activity, payload, take !== null),
          closed: !!row?.answeredAt,
        };
      }),
      previous: openIndex > 0 ? { position: openIndex, closedByClock: !!before?.wasLate } : null,
      last: openIndex === view.stages.length - 1,
    };
  }

  return {
    step,
    position,
    path: hiringStepSuffix(step, position),
    orgName: input.orgName,
    positionName: input.opening.positionName,
    candidateName: inv.candidateName,
    intro: { title: input.version.introTitle, body: input.version.introBody },
    stages: view.stages.map((s, i) => ({
      position: i + 1,
      name: s.name,
      minutes: Math.ceil((effectiveSeconds(s.durationSeconds, pct) + graceByStage[s.id]) / 60),
      graceSeconds: graceByStage[s.id],
      questions: s.activities.length,
      done: !!runOf(s.id)?.submittedAt,
    })),
    totalMinutes: estimatedMinutes(view, pct, graceByStage),
    reviewers: inv.reviewers,
    signals: recordedSignals(view),
    devices,
    extraTimePct: pct,
    extraTimeLocked: !!inv.completedAt || input.runs.some((r) => r.startedAt && !r.submittedAt),
    practice: input.version.practiceEnabled && devices.microphone,
    contactEmail: input.contactEmail,
    retention: input.retention,
    current,
    finished: inv.completedAt
      ? {
          completedAt: inv.completedAt.toISOString(),
          stagesDone: input.runs.filter((r) => r.submittedAt).length,
          feedbackBy: new Date(inv.completedAt.getTime() + input.opening.feedbackDays * 86_400_000).toISOString(),
          survey: { enabled: input.opening.finishSurveyEnabled, answered: inv.surveyAnswered },
        }
      : null,
  };
}
