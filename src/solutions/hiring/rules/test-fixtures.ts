import type { CompetencyFacts, ContentActivity, ContentStage, VersionContent } from "./content";

export function activity(id: string, over: Partial<ContentActivity> = {}): ContentActivity {
  return {
    id,
    orderIndex: 0,
    type: "VIDEO",
    required: true,
    prompt: { tr: "Bir örnek anlat.", en: "" },
    note: { tr: "", en: "" },
    internalQuestion: null,
    expectedBehaviours: [],
    redFlags: [],
    managerNotes: null,
    answerExamples: {},
    thinkSeconds: 60,
    flexibleThink: true,
    answerSeconds: 120,
    maxTakes: 2,
    config: {},
    competencyIds: [],
    ...over,
  };
}

export function stage(id: string, activities: ContentActivity[], over: Partial<ContentStage> = {}): ContentStage {
  return {
    id,
    orderIndex: 0,
    name: { tr: "Aşama", en: "" },
    description: { tr: "", en: "" },
    internalPurpose: null,
    durationSeconds: 600,
    graceSeconds: 0,
    onTimeout: "AUTO_SUBMIT",
    backNavigation: false,
    activities,
    ...over,
  };
}

export function content(stages: ContentStage[], over: Partial<VersionContent> = {}): VersionContent {
  return { id: "v1", number: 1, status: "DRAFT", defaultLocale: "tr", localeSet: ["tr"], weightsEnabled: false, draftWeights: null, previewedAt: null, stages, ...over };
}

export function facts(id: string, over: Partial<CompetencyFacts> = {}): CompetencyFacts {
  return {
    id,
    name: { tr: `Yetkinlik ${id}`, en: `Competency ${id}` },
    description: { tr: "", en: "" },
    archived: false,
    anchors: { 1: { tr: "bir", en: "one" }, 3: { tr: "üç", en: "three" }, 5: { tr: "beş", en: "five" } },
    tags: [],
    ...over,
  };
}
