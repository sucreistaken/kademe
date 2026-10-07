"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Disclosure } from "@/components/visual/disclosure";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { openingRulesProblems, type OpeningRulesInput } from "@/solutions/hiring/rules/opening-rules";
import type { ContentStage } from "@/solutions/hiring/rules/content";
import { publishOpeningAction } from "@/app/(manager)/hiring/openings/[id]/actions";
import { saveOpeningRulesAction } from "@/app/(manager)/hiring/openings/[id]/settings/actions";
import { generateAndApplyDraftAction, reviseAssessmentAction, undoReviseAction } from "@/app/(manager)/hiring/openings/[id]/setup/actions";
import { useSaver } from "@/components/hiring/builder/use-saver";
import type { SettingsUser } from "@/components/hiring/opening-settings-form";
import { wizardJourney } from "@/components/hiring/new-opening-steps";
import { AiUndoLine, QuestionList } from "./question-list";
import { AI_UNDO_MS, aiCodeKey, publishRules, questionsIntro, rulesChanged, SETUP_STEPS, teamChoiceOf, type SetupStep, type TeamChoice } from "./setup-model";

const LINK =
  "inline-flex min-h-11 items-center gap-0.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";
const CHOICE =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-2.5 text-[15px] transition-colors duration-[120ms] ease-out has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";

export type SetupPreview = { stages: Array<{ id: string; name: string; minutes: number; questions: number }>; minutes: number; questions: number };

/**
 * HIRING-UX 5.20 steps 2 and 3 as one GuidedFlow on /setup, the step in the
 * hash (#questions, #publish), "Adım 2 / 3" and "Adım 3 / 3" in the footer.
 *
 * Step 2 "Adaya ne soralım?": arriving from step 1's AI start (?draft=ai) on
 * an empty draft writes the AI's questions at once ("Sorular hazırlanıyor"),
 * all added; "AI'a söyle" changes the whole list (on an empty list with a job
 * ad it writes the first questions), and its "Geri al" stays by the box until
 * the next change or the token's ten minutes; the list edits, fixes with AI and
 * deletes each question; one scorecard line with "Değiştir". "Devam: önizle ve yayınla" waits with the gate's first problem.
 *
 * Step 3 "Hazır mı?": the candidate's short preview, the team ("Sadece sen" or
 * "Kişi ekle"), an optional last day and the rules folded with their defaults.
 * "Yayınla" saves what changed here, publishes (the existing gate and action)
 * and the overview opens the invite Sheet.
 */
export function SetupWizard({
  openingId,
  kicker,
  locale,
  contentLocale,
  stages,
  competencies,
  autoDraft,
  canDraft,
  blocking,
  scorecard,
  preview,
  me,
  users,
  saved,
  today,
  zone,
  notice,
  initialActivity,
}: {
  openingId: string;
  kicker: string;
  locale: Locale;
  /** The content's default language: the short question editor writes in it. */
  contentLocale: Locale;
  stages: ContentStage[];
  competencies: Array<{ id: string; name: string; archived: boolean }>;
  /** Step 1's AI start on an empty draft: write the questions now. */
  autoDraft: boolean;
  /** The position has a job ad, so an empty draft can still be written by the AI. */
  canDraft: boolean;
  /** The publish gate's first problem, in its sentence; null when the draft may go live. */
  blocking: { text: string; scorecard: boolean } | null;
  scorecard: { count: number; weights: "equal" | "custom"; href: string };
  preview: SetupPreview & { href: string };
  me: string;
  users: SettingsUser[];
  saved: OpeningRulesInput;
  today: string;
  zone: string;
  /** A refused publish, in its sentence. */
  notice: string | null;
  initialActivity: string | null;
}) {
  const t = useMT("hiringWizard");
  const rulesT = useMT("hiringSettings");
  const flow = useMT("flow");
  const router = useRouter();
  const nav = useFlowStep({ steps: SETUP_STEPS, firstInvalid: blocking ? "questions" : null, mode: "hash" });
  const step: SetupStep = nav.step;
  const [epoch, setEpoch] = useState(0);
  const saver = useSaver(openingId, true, () => setEpoch((e) => e + 1));
  const waiting = saver.state.kind === "saving" || (saver.state.kind === "error" && saver.state.retryable);

  // Step 2: the first draft, written once on arrival from step 1's AI start.
  const [drafting, setDrafting] = useState<"idle" | "working" | "failed">(autoDraft ? "working" : "idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const started = useRef(false);
  function writeDraft() {
    setDrafting("working");
    setDraftError(null);
    void (async () => {
      try {
        const res = await generateAndApplyDraftAction(openingId);
        if (!res.ok) {
          setDrafting("failed");
          setDraftError(t(aiCodeKey(res.code)));
          return;
        }
        setDrafting("idle");
        // ?draft=ai is spent: a reload never writes a second draft.
        router.replace(`/hiring/openings/${openingId}/setup#questions`);
        router.refresh();
      } catch {
        setDrafting("failed");
        setDraftError(t("aiFailed"));
      }
    })();
  }
  useEffect(() => {
    if (!autoDraft || started.current) return;
    started.current = true;
    writeDraft();
    // Once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDraft]);

  // "AI'a söyle" for the whole list, and the undo of the last AI change.
  const [instruction, setInstruction] = useState("");
  const [tellError, setTellError] = useState<string | null>(null);
  const [telling, startTelling] = useTransition();
  // The last AI change's undo: by the box ("all") or under one question. It
  // lasts as long as the server's token (ten minutes) or until the next change.
  const [aiUndo, setAiUndo] = useState<{ token: string; target: "all" | { activityId: string } } | null>(null);
  useEffect(() => {
    if (!aiUndo) return;
    const timer = setTimeout(() => setAiUndo(null), AI_UNDO_MS);
    return () => clearTimeout(timer);
  }, [aiUndo]);
  // "AI ile düzelt" on one question runs in the list; the footer waits for it too.
  const [fixing, setFixing] = useState(false);
  function tell() {
    const text = instruction.trim();
    if (!text) return;
    setTellError(null);
    startTelling(async () => {
      await saver.queue.flush();
      try {
        const res = await reviseAssessmentAction(openingId, { instruction: text, target: { kind: "all" } });
        if (!res.ok) {
          setTellError(t(aiCodeKey(res.code)));
          return;
        }
        setInstruction("");
        setAiUndo({ token: res.undoToken, target: "all" });
        setEpoch((e) => e + 1);
        router.refresh();
      } catch {
        setTellError(t("aiFailed"));
      }
    });
  }
  async function undoRevision(token: string) {
    await saver.queue.flush();
    const res = await undoReviseAction(openingId, token);
    setAiUndo(null);
    if (!res.ok) setTellError(t("undoFailed"));
    setEpoch((e) => e + 1);
    router.refresh();
  }

  // Step 3: the team, the last day and the rules, saved before "Yayınla" when changed.
  const [team, setTeam] = useState<TeamChoice>(() => teamChoiceOf(saved.memberIds, me));
  const [deadline, setDeadline] = useState(saved.deadline ?? "");
  const [blindMode, setBlindMode] = useState(saved.blindMode);
  const [feedbackDays, setFeedbackDays] = useState(String(saved.feedbackDays));
  const [email, setEmail] = useState(saved.candidateContactEmail);
  const [survey, setSurvey] = useState(saved.finishSurveyEnabled ?? false);
  const [publishing, startPublishing] = useTransition();
  const [publishError, setPublishError] = useState<string | null>(null);
  const next = publishRules(saved, {
    team,
    me,
    deadline,
    blindMode,
    feedbackDays: /^\d{1,3}$/.test(feedbackDays.trim()) ? Number(feedbackDays.trim()) : Number.NaN,
    candidateContactEmail: email.trim(),
    finishSurveyEnabled: survey,
  });
  const panelUsers = users.map((u) => ({ id: u.id, role: u.role, disabled: u.disabled }));
  const ruleProblem = openingRulesProblems(next, panelUsers, today, saved.deadline)[0] ?? null;
  const others = users.filter((u) => u.id !== me && !u.disabled);

  function publish() {
    setPublishError(null);
    startPublishing(async () => {
      if (rulesChanged(saved, next)) {
        const res = await saveOpeningRulesAction(openingId, next);
        if (!res.ok) {
          setPublishError("problems" in res ? rulesT(`p${res.problems[0] ?? "NAME_REQUIRED"}`) : rulesT(`err${res.code}`));
          return;
        }
      }
      const form = new FormData();
      form.set("openingId", openingId);
      form.set("back", "setup");
      // The action answers with a redirect: the overview with the invite Sheet open, or this step with the refusal.
      await publishOpeningAction(form);
    });
  }

  const intro = questionsIntro({ questions: stages.reduce((sum, s) => sum + s.activities.length, 0), canDraft });
  const empty = stages.length === 0;
  const tellBox = (
    <form
      className="space-y-2 rounded-xl border border-line bg-canvas p-4"
      onSubmit={(e) => {
        e.preventDefault();
        tell();
      }}
    >
      <Label htmlFor="wizard-tell">{t("tellAi")}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="wizard-tell"
          placeholder={empty ? t("tellPlaceholderEmpty") : t("tellPlaceholder")}
          maxLength={500}
          value={instruction}
          disabled={telling}
          onChange={(e) => setInstruction(e.target.value)}
          className="h-11 min-w-[240px] flex-1 bg-surface text-[16px]"
        />
        <Button type="submit" disabled={telling || !instruction.trim()} disabledReason={telling ? t("applying") : t("needInstruction")}>
          {telling ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              {t("applying")}
            </>
          ) : (
            t("apply")
          )}
        </Button>
      </div>
      {tellError ? (
        <p role="alert" className="text-[14px] font-medium text-ink">
          {tellError}
        </p>
      ) : (
        <p role="status" className="text-[13px] text-muted">
          {telling ? t("applyingLong") : empty ? t("tellHintEmpty") : t("tellHint")}
        </p>
      )}
      {aiUndo && aiUndo.target === "all" && !telling ? <AiUndoLine onUndo={() => undoRevision(aiUndo.token)} /> : null}
      {empty && canDraft && !telling ? (
        <button type="button" id="wizard-write-draft" className={LINK} onClick={writeDraft}>
          {t("writeDraft")}
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </form>
  );

  const scorecardRow = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3">
      <p className="tnum text-[14px] text-ink">
        {t("scorecardLine", { count: scorecard.count })} · {scorecard.weights === "custom" ? t("weightsCustom") : t("weightsEqual")}
      </p>
      <Link href={scorecard.href} className={LINK}>
        {flow("change")}
        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
      </Link>
    </div>
  );

  const questionsBody =
    drafting === "working" ? (
      <div role="status" className="flex items-start gap-3 rounded-xl border border-line bg-surface p-5">
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-accent motion-reduce:animate-none" aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-ink">{t("generating")}</p>
          <p className="text-[14px] text-ink-2">{t("generatingBody")}</p>
        </div>
      </div>
    ) : (
      <div className="space-y-6">
        {intro.tellBox ? tellBox : null}
        {drafting === "failed" && draftError ? (
          <div role="alert" className="space-y-1 rounded-xl border border-line bg-surface p-4">
            <p className="text-[14px] font-medium text-ink">{draftError}</p>
            <button type="button" className={LINK} onClick={writeDraft}>
              {t("retry")}
            </button>
          </div>
        ) : null}
        <QuestionList
          openingId={openingId}
          stages={stages}
          competencies={competencies}
          locale={locale}
          saver={saver}
          epoch={epoch}
          initialOpen={initialActivity}
          contentLocale={contentLocale}
          aiUndo={aiUndo && aiUndo.target !== "all" ? { activityId: aiUndo.target.activityId, undo: () => undoRevision(aiUndo.token) } : null}
          onRevised={(token, activityId) => setAiUndo({ token, target: { activityId } })}
          onChanged={() => setAiUndo(null)}
          onBusy={setFixing}
        />
        {stages.length > 0 ? scorecardRow : null}
      </div>
    );

  const questionsStep: FlowStep = {
    id: "questions",
    title: t("questionsTitle"),
    lead: <p>{t(intro.lead)}</p>,
    layout: "single",
    primary: {
      kind: "button",
      id: "wizard-to-publish",
      label: t("toPublish"),
      waitReason: drafting === "working" ? t("generating") : telling || fixing ? t("applyingLong") : waiting ? t("unsavedFirst") : (blocking?.text ?? null),
      onClick: () => {
        void saver.queue.flush().then(() => nav.go("publish"));
      },
    },
    note: blocking?.scorecard ? (
      <Link href={scorecard.href} className={LINK}>
        {t("fixScorecard")}
      </Link>
    ) : null,
    body: questionsBody,
  };

  const choiceClass = (on: boolean) => cn(CHOICE, on ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink hover:bg-canvas");
  const rulesLine = [
    blindMode ? t("rulesBlindOn") : t("rulesBlindOff"),
    t("rulesFeedback", { days: Number(feedbackDays) || saved.feedbackDays }),
    survey ? t("rulesSurveyOn") : t("rulesSurveyOff"),
  ].join(" · ");

  const publishBody = (
    <div className="space-y-6">
      <section aria-labelledby="wizard-preview-title" className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="wizard-preview-title" className="text-[15px] font-semibold text-ink">
            {t("previewTitle")}
          </h2>
          <p className="tnum text-[13px] text-muted">{t("previewTotals", { stages: preview.stages.length, questions: preview.questions, minutes: preview.minutes })}</p>
        </div>
        <ol className="divide-y divide-line border-t border-line">
          {preview.stages.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
              <span className="text-[14px] text-ink">{s.name || t("stageN", { n: i + 1 })}</span>
              <span className="tnum text-[13px] text-muted">{t("stageMeta", { minutes: s.minutes, count: s.questions })}</span>
            </li>
          ))}
        </ol>
        <Link href={preview.href} className={LINK}>
          {t("openPreview")}
          <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
        </Link>
      </section>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-[15px] font-semibold text-ink">{t("teamTitle")}</legend>
        <label className={choiceClass(team.solo)}>
          <input type="radio" name="wizard-team" className="size-4 accent-[var(--color-accent)]" checked={team.solo} onChange={() => setTeam({ solo: true, others: team.others })} />
          {t("onlyYou")}
        </label>
        <label className={choiceClass(!team.solo)}>
          <input type="radio" name="wizard-team" className="size-4 accent-[var(--color-accent)]" checked={!team.solo} onChange={() => setTeam({ solo: false, others: team.others })} />
          {t("addPeople")}
        </label>
        {!team.solo ? (
          others.length ? (
            <ul className="space-y-1 pl-2">
              {others.map((u) => {
                const id = `wizard-member-${u.id}`;
                const on = team.others.includes(u.id);
                return (
                  <li key={u.id} className="flex min-h-11 items-center gap-3">
                    <Checkbox
                      id={id}
                      checked={on}
                      onCheckedChange={(v) => setTeam({ solo: false, others: v === true ? [...team.others, u.id] : team.others.filter((x) => x !== u.id) })}
                    />
                    <Label htmlFor={id} className="text-[15px] font-normal text-ink">
                      {u.name} <span className="text-[13px] text-muted">{rulesT(`role${u.role}`)}</span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pl-2 text-[14px] text-muted">
              {t("noOthers")}{" "}
              <Link href="/settings/users" className={LINK}>
                {t("inviteTeammate")}
              </Link>
            </p>
          )
        ) : null}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="wizard-deadline" className="text-[15px] font-semibold text-ink">
          {t("deadlineTitle")}
        </Label>
        <Input id="wizard-deadline" type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-11 w-[220px] text-[16px]" aria-describedby="wizard-deadline-hint" />
        <p id="wizard-deadline-hint" className="text-[13px] text-muted">
          {t("deadlineHint", { zone })}
        </p>
      </div>

      <Disclosure label={<span className="flex flex-col"><span>{t("rulesTitle")}</span><span className="text-[13px] font-normal text-muted">{rulesLine}</span></span>}>
        <div className="space-y-5 pt-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="wizard-blind">{rulesT("blindMode")}</Label>
              <p className="text-[13px] text-muted">{rulesT("blindModeHint")}</p>
            </div>
            <Switch id="wizard-blind" checked={blindMode} onCheckedChange={setBlindMode} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-feedback">{rulesT("feedbackDays")}</Label>
            <Input id="wizard-feedback" inputMode="numeric" value={feedbackDays} onChange={(e) => setFeedbackDays(e.target.value)} className="h-10 w-[120px]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wizard-email">{rulesT("contactEmail")}</Label>
            <Input id="wizard-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" aria-describedby="wizard-email-hint" />
            <p id="wizard-email-hint" className="text-[13px] text-muted">
              {rulesT("emailLead")}
            </p>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="wizard-survey">{rulesT("finishSurvey")}</Label>
              <p className="text-[13px] text-muted">{rulesT("finishSurveyHint")}</p>
            </div>
            <Switch id="wizard-survey" checked={survey} onCheckedChange={setSurvey} />
          </div>
        </div>
      </Disclosure>
    </div>
  );

  const publishStep: FlowStep = {
    id: "publish",
    title: t("publishTitle"),
    lead: <p>{t("publishLead")}</p>,
    layout: "single",
    primary: {
      kind: "button",
      id: "wizard-publish",
      label: t("publish"),
      busy: publishing,
      busyLabel: t("publishing"),
      waitReason: blocking?.text ?? (ruleProblem ? rulesT(`p${ruleProblem}`) : null),
      onClick: publish,
    },
    note:
      publishError || notice ? (
        <p role="alert" className="text-[14px] font-medium text-ink">
          {publishError ?? notice}
        </p>
      ) : null,
    body: publishBody,
  };

  return (
    <>
      <GuidedFlow
        kicker={kicker}
        step={step === "publish" ? publishStep : questionsStep}
        journey={wizardJourney(step)}
        back={step === "publish" ? { label: flow("back"), onClick: () => nav.back() } : null}
        exit={{ dirty: false, href: `/hiring/openings/${openingId}` }}
        enter={nav.moved}
      />
    </>
  );
}
