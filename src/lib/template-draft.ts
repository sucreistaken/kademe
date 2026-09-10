import { z } from "zod";
import type { AiMessage } from "@/lib/ai";

/**
 * The job ad to assessment draft: schema, prompt and validation.
 *
 * Everything here is pure, so the part that would quietly ruin a draft can be
 * tested without an API key. The database side lives in `template-draft-job.ts`
 * and the screen in the `/versions/[v]/ai` route.
 *
 * What the model is asked for is a *proposal*, never a change. Nothing in this
 * file writes anything; a suggestion becomes a stage only when the manager
 * presses "Kabul et" on its card.
 */

/**
 * The activity types the model may suggest.
 *
 * SINGLE_CHOICE and MULTI_CHOICE are deliberately absent. A choice question
 * carries an answer key and feeds the separate Knowledge Score, so writing one
 * means deciding what counts as the right answer. That is the manager's call,
 * not a model's, and a wrong key generated from an ad would silently mark
 * correct answers wrong.
 */
export const SUGGESTABLE_ACTIVITY_TYPES = [
  "VIDEO",
  "AUDIO",
  "LONG_TEXT",
  "SHORT_TEXT",
  "SCENARIO",
  "FILE_UPLOAD",
] as const;

export type SuggestableActivityType = (typeof SUGGESTABLE_ACTIVITY_TYPES)[number];

/** Bounds the database and the candidate timer can live with. */
const LIMITS = {
  stageSeconds: { min: 60, max: 7200 },
  thinkSeconds: { min: 0, max: 600 },
  answerSeconds: { min: 30, max: 1800 },
  maxStages: 4,
  maxActivitiesPerStage: 5,
  maxCompetencies: 8,
  maxListItems: 6,
} as const;

/**
 * What an assessment is allowed to cost the candidate.
 *
 * Left to itself the model writes a thorough assessment nobody will ever
 * finish: the first real run came back at 106 minutes across six stages, one of
 * them 31 minutes, with a file upload in four of them. That is homework, not an
 * evaluation, and a candidate simply abandons it. The canvas reference is three
 * stages and 24 minutes.
 *
 * These bounds are in the prompt and checked again afterwards, because a limit
 * that only lives in a prompt is a suggestion.
 */
export const DRAFT_BUDGET = {
  totalTargetSeconds: 1500,
  totalMinSeconds: 900,
  totalMaxSeconds: 1800,
  maxStages: LIMITS.maxStages,
  stageMaxSeconds: 720,
  /** A recorded answer past three minutes is rambling, not depth. */
  mediaAnswerMaxSeconds: 180,
  /** Asking for a work sample is fair once. Four times is unpaid labour. */
  fileUploadStages: 1,
} as const;

/**
 * How much job ad text the builder will work from.
 *
 * The floor is not a formality: an ad of two lines gives the model nothing to
 * anchor on and it answers with generic stages that fit any job, which is
 * exactly the draft a manager cannot use. The ceiling is the practical one, a
 * whole careers page pasted in at once.
 *
 * Two numbers, not one, because they answer different questions.
 *
 * `JOB_AD_MIN_CHARS` is the hard floor and it is deliberately low: it exists to
 * stop a job title or a keyboard mash reaching the model, nothing more. Two
 * short Turkish sentences come to about 98 characters, and a manager who typed
 * those has told the model something real. Blocking them would be a dead end.
 *
 * `JOB_AD_THIN_CHARS` blocks nothing. Below it the draft still runs and the
 * screen says the suggestions will be rough, because that is a judgement the
 * manager can make and a button cannot.
 */
export const JOB_AD_MIN_CHARS = 40;
export const JOB_AD_THIN_CHARS = 120;
export const JOB_AD_MAX_CHARS = 20_000;

/**
 * Which end of the bounds a job ad falls outside, or null when it is usable.
 *
 * Separate codes because the two need opposite advice. A single length check
 * that reports "too short" for a 40000 character paste tells the manager to
 * write more when the fix is to write less, and they will keep pasting.
 */
export function jobAdProblem(text: string): null | "TOO_SHORT" | "TOO_LONG" {
  const length = text.trim().length;
  if (length < JOB_AD_MIN_CHARS) return "TOO_SHORT";
  if (length > JOB_AD_MAX_CHARS) return "TOO_LONG";
  return null;
}

/**
 * Usable, but thin. Advice, not a gate: the caller shows a line and keeps the
 * button live.
 */
export function isJobAdThin(text: string): boolean {
  const length = text.trim().length;
  return length >= JOB_AD_MIN_CHARS && length < JOB_AD_THIN_CHARS;
}

/**
 * Numbers are validated loosely on purpose. A model that answers 2100 seconds
 * for a stage is useful and gets clamped by `normalizeDraft`; failing the whole
 * draft over it would spend a repair attempt on nothing.
 */
const seconds = z.number().int().min(0).max(100_000);

const activitySchema = z.object({
  key: z.string().min(1).max(40),
  type: z.enum(SUGGESTABLE_ACTIVITY_TYPES),
  promptTr: z.string().min(1).max(2000),
  promptEn: z.string().max(2000),
  noteTr: z.string().max(600),
  noteEn: z.string().max(600),
  internalQuestion: z.string().max(1000),
  internalObjective: z.string().max(1000),
  expectedBehaviours: z.array(z.string().max(300)).max(20),
  redFlags: z.array(z.string().max(300)).max(20),
  thinkSeconds: seconds,
  answerSeconds: seconds,
  rationale: z.string().max(800),
});

export const stageSuggestionSchema = z.object({
  key: z.string().min(1).max(40),
  nameTr: z.string().min(1).max(160),
  nameEn: z.string().max(160),
  descriptionTr: z.string().max(1000),
  descriptionEn: z.string().max(1000),
  internalPurpose: z.string().max(1000),
  internalObjective: z.string().max(1000),
  durationSeconds: seconds,
  rationale: z.string().max(800),
  activities: z.array(activitySchema).min(1).max(20),
});

export const competencySuggestionSchema = z.object({
  key: z.string().min(1).max(40),
  nameTr: z.string().min(1).max(160),
  nameEn: z.string().max(160),
  descriptionTr: z.string().max(600),
  descriptionEn: z.string().max(600),
  stageKeys: z.array(z.string().max(40)).max(20),
  rationale: z.string().max(800),
});

export const draftSchema = z.object({
  stages: z.array(stageSuggestionSchema).min(1).max(20),
  competencies: z.array(competencySuggestionSchema).max(20),
});

export type TemplateDraft = z.infer<typeof draftSchema>;
export type StageSuggestion = z.infer<typeof stageSuggestionSchema>;
export type ActivitySuggestion = z.infer<typeof activitySchema>;
export type CompetencySuggestion = z.infer<typeof competencySuggestionSchema>;

/**
 * The same shape as `draftSchema`, in the form OpenRouter passes to the
 * provider. Kept by hand rather than generated: strict mode needs every
 * property required and `additionalProperties: false` everywhere, which is
 * exactly what a generator has to be argued into producing.
 */
export const TEMPLATE_DRAFT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["stages", "competencies"],
  properties: {
    stages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "nameTr",
          "nameEn",
          "descriptionTr",
          "descriptionEn",
          "internalPurpose",
          "internalObjective",
          "durationSeconds",
          "rationale",
          "activities",
        ],
        properties: {
          key: { type: "string", description: "Short unique id, e.g. s1" },
          nameTr: { type: "string" },
          nameEn: { type: "string" },
          descriptionTr: { type: "string" },
          descriptionEn: { type: "string" },
          internalPurpose: { type: "string" },
          internalObjective: { type: "string" },
          durationSeconds: { type: "integer" },
          rationale: { type: "string" },
          activities: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "key",
                "type",
                "promptTr",
                "promptEn",
                "noteTr",
                "noteEn",
                "internalQuestion",
                "internalObjective",
                "expectedBehaviours",
                "redFlags",
                "thinkSeconds",
                "answerSeconds",
                "rationale",
              ],
              properties: {
                key: { type: "string" },
                type: { type: "string", enum: [...SUGGESTABLE_ACTIVITY_TYPES] },
                promptTr: { type: "string" },
                promptEn: { type: "string" },
                noteTr: { type: "string" },
                noteEn: { type: "string" },
                internalQuestion: { type: "string" },
                internalObjective: { type: "string" },
                expectedBehaviours: { type: "array", items: { type: "string" } },
                redFlags: { type: "array", items: { type: "string" } },
                thinkSeconds: { type: "integer" },
                answerSeconds: { type: "integer" },
                rationale: { type: "string" },
              },
            },
          },
        },
      },
    },
    competencies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "nameTr",
          "nameEn",
          "descriptionTr",
          "descriptionEn",
          "stageKeys",
          "rationale",
        ],
        properties: {
          key: { type: "string" },
          nameTr: { type: "string" },
          nameEn: { type: "string" },
          descriptionTr: { type: "string" },
          descriptionEn: { type: "string" },
          stageKeys: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
      },
    },
  },
};

export type DraftRequest = {
  positionName: string;
  jobDescription: string;
  /** Which languages this template version is authored in. */
  locales: Array<"tr" | "en">;
  /** Names already in the org's competency library, so the model reuses them
   *  instead of inventing a near duplicate of one that exists. */
  existingCompetencies: string[];
};

const SYSTEM_PROMPT = `You design structured, asynchronous candidate assessments. You are drafting a proposal for a hiring manager who will accept, edit or delete each item by hand.

Hard limits on what you produce:
- You never score, rank, shortlist or reject a candidate, and you never suggest a feature that would. You design how the evaluation is conducted; the human evaluates.
- You never propose inferring emotion, personality, confidence or mental state from video, voice or face. That is a prohibited practice under the EU AI Act.
- You never propose questions about age, gender, marital or family status, pregnancy, health or disability, religion, ethnicity, sexual orientation, political views or union membership.
- Every question must be answerable in a recording or a text box, alone, with no interviewer present.
- Every question must be about job relevant behaviour, work samples, or reasoning that the job ad actually asks for. If the ad does not support an idea, leave it out rather than padding the draft.

Activity types, and the type is what decides the answer box the candidate sees:
- VIDEO and AUDIO are answers the candidate records by speaking into a camera or a microphone. Use them only when hearing the answer is the point.
- LONG_TEXT, SHORT_TEXT and SCENARIO are answers the candidate types. Any question asking for a written plan, a document, an API sketch, a metric definition or a list must use one of these.
- Never label a written task VIDEO or AUDIO, and never write "yanıtınızı metin kutusuna yazın" inside a VIDEO activity. A candidate given that combination is sat in front of a camera and asked to type.

Writing rules:
- Turkish fields are written in natural Turkish, not translated English. Address the candidate with "siz".
- Candidate facing text (promptTr, nameTr, descriptionTr, noteTr) is what the candidate reads verbatim. It must be self contained and free of internal jargon.
- Internal fields (internalPurpose, internalObjective, internalQuestion, expectedBehaviours, redFlags) are for the manager only and are never shown to the candidate. Write what a good answer looks like and what should worry the reader.
- rationale explains, in one or two sentences, which part of the job ad the item comes from. Quote the ad where you can. Never use an em dash anywhere.

Timing, and this is the part drafts get wrong most often:
- The whole assessment must fit in 15 to 30 minutes of candidate time, and about 25 minutes is the target. A candidate abandons anything longer, so a thorough assessment nobody finishes is worth less than a short one they complete.
- Propose 3 or 4 stages. Never more. Cut the weakest idea rather than adding a stage.
- No single stage may exceed 12 minutes.
- thinkSeconds is silent preparation time before answering, answerSeconds is the time to answer. For VIDEO and AUDIO keep thinkSeconds between 30 and 120 and answerSeconds between 60 and 180. A recorded answer longer than three minutes is rambling, not depth. For text activities thinkSeconds is 0 and answerSeconds is a writing budget.
- FILE_UPLOAD may appear in at most one stage, and only if the ad genuinely asks for a portfolio or a work sample. Asking a candidate to produce files in several stages is unpaid work.
- Favour VIDEO and written answers. They are what this product is built to review.
- durationSeconds for a stage covers all of its activities plus a little slack.`;

export function buildDraftMessages(request: DraftRequest): AiMessage[] {
  const wantsEnglish = request.locales.includes("en");
  const library = request.existingCompetencies.length
    ? request.existingCompetencies.join(", ")
    : "(kütüphane boş)";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `Pozisyon: ${request.positionName}`,
        "",
        "İş ilanı metni:",
        '"""',
        request.jobDescription.trim(),
        '"""',
        "",
        `Mevcut yetkinlik kütüphanesi: ${library}`,
        "Bir yetkinlik bu listede zaten varsa aynı ismi kullan, benzerini yeniden uydurma.",
        "",
        `Toplam süre ${Math.round(DRAFT_BUDGET.totalMinSeconds / 60)} ile ${Math.round(DRAFT_BUDGET.totalMaxSeconds / 60)} dakika arasında olsun, hedef ${Math.round(DRAFT_BUDGET.totalTargetSeconds / 60)} dakika.`,
        `${LIMITS.maxStages === 4 ? "3 veya 4" : `En fazla ${LIMITS.maxStages}`} aşama öner, daha fazlasını değil. Aşama başına en fazla ${Math.round(DRAFT_BUDGET.stageMaxSeconds / 60)} dakika ve en fazla ${LIMITS.maxActivitiesPerStage} aktivite.`,
        `En fazla ${LIMITS.maxCompetencies} yetkinlik öner.`,
        `expectedBehaviours ve redFlags listelerinde en fazla ${LIMITS.maxListItems} madde olsun.`,
        "Her yetkinliğin stageKeys alanı, onu ölçen aşamaların key değerlerini içersin.",
        wantsEnglish
          ? "Bu versiyon Türkçe ve İngilizce yayınlanacak, bu yüzden hem *Tr hem *En alanlarını doldur."
          : "Bu versiyon sadece Türkçe yayınlanacak. *En alanlarını boş dize olarak bırak.",
        "",
        "İlan metni bir aşamayı desteklemiyorsa o aşamayı önerme. Az ve isabetli öneri, çok ve genel öneriden iyidir.",
      ].join("\n"),
    },
  ];
}

/**
 * The single repair attempt. The broken answer goes back with the reason it was
 * rejected; if the second try is also broken the manager is told so, because a
 * third attempt costs money and rarely changes anything.
 */
export function buildRepairMessages(
  original: AiMessage[],
  brokenAnswer: string,
  problem: string,
): AiMessage[] {
  return [
    ...original,
    { role: "assistant", content: brokenAnswer.slice(0, 20_000) },
    {
      role: "user",
      content: [
        "Bu cevap şemaya uymadı ve kullanılamadı:",
        problem.slice(0, 1500),
        "",
        "Aynı öneriyi şemaya birebir uyan tek bir JSON nesnesi olarak yeniden ver.",
        "Sadece JSON döndür, açıklama ekleme, kod bloğu kullanma.",
      ].join("\n"),
    },
  ];
}

export type ParseResult =
  | { ok: true; draft: TemplateDraft }
  | { ok: false; problem: string };

/**
 * Parses and validates a model answer.
 *
 * Two tolerances, both about packaging rather than content: a fenced code block
 * is unwrapped, and an answer that narrates around its JSON is cut back to the
 * outermost object. Reasoning models do both even with a schema attached.
 *
 * Nothing else is forgiven. A draft that does not match the schema is
 * discarded, never patched into shape by guesswork, because a guessed field
 * would reach a candidate looking exactly like an authored one.
 */
export function parseDraftAnswer(text: string): ParseResult {
  const cleaned = stripCodeFence(text);
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch (error) {
    const trimmed = trimToOutermostObject(cleaned);
    if (trimmed === null) {
      return {
        ok: false,
        problem: `JSON parse edilemedi: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    try {
      json = JSON.parse(trimmed);
    } catch (secondError) {
      return {
        ok: false,
        problem: `JSON parse edilemedi: ${
          secondError instanceof Error ? secondError.message : String(secondError)
        }`,
      };
    }
  }

  const parsed = draftSchema.safeParse(json);
  if (!parsed.success) {
    const problem = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(".") || "(kök)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, problem };
  }
  return { ok: true, draft: parsed.data };
}

/** The first "{" to the last "}", or null when there is no object at all. */
function trimToOutermostObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const cleanList = (items: string[]) =>
  items
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, LIMITS.maxListItems);

/**
 * Brings a valid draft inside the bounds the product can actually store, and
 * drops the parts that would land in the database as noise.
 *
 * This is where a slightly over-eager answer is made usable instead of thrown
 * away: an eight minute stage holding twelve minutes of activities is stretched
 * rather than rejected, because the manager can see and change the number, and
 * a stage whose timer is shorter than its own questions is a bug the candidate
 * would pay for.
 */
export function normalizeDraft(
  draft: TemplateDraft,
  locales: Array<"tr" | "en"> = ["tr"],
): TemplateDraft {
  const keepEnglish = locales.includes("en");
  const en = (value: string) => (keepEnglish ? value.trim() : "");

  const seenStageKeys = new Set<string>();
  const stages = draft.stages
    .filter((stage) => {
      if (seenStageKeys.has(stage.key)) return false;
      seenStageKeys.add(stage.key);
      return true;
    })
    .slice(0, LIMITS.maxStages)
    .map((stage) => {
      const seenActivityKeys = new Set<string>();
      const activities = stage.activities
        .filter((activity) => activity.promptTr.trim().length > 0)
        .filter((activity) => {
          if (seenActivityKeys.has(activity.key)) return false;
          seenActivityKeys.add(activity.key);
          return true;
        })
        .slice(0, LIMITS.maxActivitiesPerStage)
        .map((activity) => {
          const isMedia = activity.type === "VIDEO" || activity.type === "AUDIO";
          return {
            ...activity,
            promptTr: activity.promptTr.trim(),
            promptEn: en(activity.promptEn),
            noteTr: activity.noteTr.trim(),
            noteEn: en(activity.noteEn),
            internalQuestion: activity.internalQuestion.trim(),
            internalObjective: activity.internalObjective.trim(),
            expectedBehaviours: cleanList(activity.expectedBehaviours),
            redFlags: cleanList(activity.redFlags),
            thinkSeconds: isMedia
              ? clamp(
                  activity.thinkSeconds,
                  LIMITS.thinkSeconds.min,
                  LIMITS.thinkSeconds.max,
                )
              : 0,
            answerSeconds: clamp(
              activity.answerSeconds,
              LIMITS.answerSeconds.min,
              LIMITS.answerSeconds.max,
            ),
            rationale: activity.rationale.trim(),
          };
        });

      // A stage timer shorter than the questions inside it hands the candidate
      // an unwinnable clock, so the sum wins over the model's number.
      const needed = activities.reduce(
        (total, activity) => total + activity.thinkSeconds + activity.answerSeconds,
        0,
      );
      const durationSeconds = clamp(
        Math.max(stage.durationSeconds, needed + 60),
        LIMITS.stageSeconds.min,
        LIMITS.stageSeconds.max,
      );

      return {
        ...stage,
        nameTr: stage.nameTr.trim(),
        nameEn: en(stage.nameEn),
        descriptionTr: stage.descriptionTr.trim(),
        descriptionEn: en(stage.descriptionEn),
        internalPurpose: stage.internalPurpose.trim(),
        internalObjective: stage.internalObjective.trim(),
        rationale: stage.rationale.trim(),
        durationSeconds,
        activities,
      };
    })
    .filter((stage) => stage.activities.length > 0);

  const stageKeys = new Set(stages.map((stage) => stage.key));
  const seenCompetencyKeys = new Set<string>();
  const competencies = draft.competencies
    .filter((competency) => {
      if (seenCompetencyKeys.has(competency.key)) return false;
      seenCompetencyKeys.add(competency.key);
      return true;
    })
    .slice(0, LIMITS.maxCompetencies)
    .map((competency) => ({
      ...competency,
      nameTr: competency.nameTr.trim(),
      nameEn: en(competency.nameEn),
      descriptionTr: competency.descriptionTr.trim(),
      descriptionEn: en(competency.descriptionEn),
      rationale: competency.rationale.trim(),
      // A competency pointing at a stage that did not survive would render a
      // card whose "accept" button has nothing to attach to.
      stageKeys: [...new Set(competency.stageKeys)].filter((key) =>
        stageKeys.has(key),
      ),
    }));

  return { stages, competencies };
}

/** Total wall clock the draft would ask of a candidate. Shown on the screen. */
export function draftTotalSeconds(draft: TemplateDraft): number {
  return draft.stages.reduce((total, stage) => total + stage.durationSeconds, 0);
}

/**
 * Whether a valid draft is also a usable one.
 *
 * Run after `normalizeDraft`, on the draft as it would actually be offered. A
 * violation is not a broken answer, so it is not thrown away: it is sent back
 * to the model as the reason for the one repair attempt. If the second answer
 * is still over budget the suggestions are shown anyway with the overrun
 * spelled out, because a manager who can see "106 dakika" on the screen can
 * shorten a stage, and four minutes of waiting should not end in nothing.
 *
 * Returns null when the draft is within budget, otherwise the reasons in
 * Turkish, ready to be handed to `buildRepairMessages`.
 */
export function checkDraftBudget(draft: TemplateDraft): string | null {
  const problems: string[] = [];
  const minutes = (seconds: number) => Math.round(seconds / 60);

  const total = draftTotalSeconds(draft);
  if (total > DRAFT_BUDGET.totalMaxSeconds) {
    problems.push(
      `Toplam süre ${minutes(total)} dakika, en fazla ${minutes(
        DRAFT_BUDGET.totalMaxSeconds,
      )} dakika olmalı (hedef ${minutes(DRAFT_BUDGET.totalTargetSeconds)}).`,
    );
  }
  if (draft.stages.length > DRAFT_BUDGET.maxStages) {
    problems.push(
      `${draft.stages.length} aşama var, en fazla ${DRAFT_BUDGET.maxStages} olmalı.`,
    );
  }

  const longStages = draft.stages.filter(
    (stage) => stage.durationSeconds > DRAFT_BUDGET.stageMaxSeconds,
  );
  for (const stage of longStages) {
    problems.push(
      `"${stage.nameTr}" aşaması ${minutes(stage.durationSeconds)} dakika, en fazla ${minutes(
        DRAFT_BUDGET.stageMaxSeconds,
      )} dakika olmalı.`,
    );
  }

  for (const stage of draft.stages) {
    for (const activity of stage.activities) {
      const isMedia = activity.type === "VIDEO" || activity.type === "AUDIO";
      if (isMedia && activity.answerSeconds > DRAFT_BUDGET.mediaAnswerMaxSeconds) {
        // Seen in a real run: a written task labelled VIDEO with a ten minute
        // answer time and a prompt ending "yanıtınızı metin kutusuna yazın".
        // The type decides which answer box the candidate gets, so this is not
        // a labelling detail, and the fix is named here rather than left to the
        // model to guess.
        problems.push(
          `"${stage.nameTr}" aşamasında ${activity.answerSeconds} saniyelik bir ${activity.type} cevabı var. Kayıtlı cevap en fazla ${DRAFT_BUDGET.mediaAnswerMaxSeconds} saniye olmalı; soru yazıyla cevaplanacaksa tipi LONG_TEXT olmalı, VIDEO değil.`,
        );
      }
    }
  }

  const uploadStages = draft.stages.filter((stage) =>
    stage.activities.some((activity) => activity.type === "FILE_UPLOAD"),
  );
  if (uploadStages.length > DRAFT_BUDGET.fileUploadStages) {
    problems.push(
      `${uploadStages.length} aşamada dosya yükleme isteniyor, en fazla ${DRAFT_BUDGET.fileUploadStages} aşamada olmalı. Kalanları video veya yazılı cevaba çevir.`,
    );
  }

  return problems.length ? problems.join(" ") : null;
}
