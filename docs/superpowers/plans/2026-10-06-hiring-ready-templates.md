# Ready Hiring Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A manager starts an opening with "Hazır şablondan başla", picks one of 20 roles and gets an assessment that passes every blocking publish gate right away.

**Architecture:** Templates are typed TS data in `src/solutions/hiring/templates/` (one file per role, shared builders, one validation test over all of them). `createOpening` gains `start: "TEMPLATE"` + `templateKey`: inside its transaction it finds or creates the template's competencies in the organisation's library, writes stages through the existing `insertStageRows`, sets draft weights, and fills an empty position. The new-opening flow gets a fourth start card and a gallery step (mockup 4b).

**Tech Stack:** Next.js 16.3.4 App Router, React 19, drizzle-orm (Postgres), zod 4, next-intl 4 (`useMT`), vitest 5 with the recording fake DB (`src/solutions/hiring/server/test-fake-db.ts`), lucide-react 1.42.0.

**Spec:** `docs/superpowers/specs/2026-10-06-hiring-ready-templates-design.md`. Mockup frames 4 and 4b in `docs/design/hiring-manager-mockup.html`.

## Global Constraints

- Read `AGENTS.md`: this Next.js differs from training data; read `node_modules/next/dist/docs/` before using any Next API the touched files do not already use.
- The old start values keep their behaviour: `AI | COPY | BLANK` inputs, results and refusals are unchanged (existing tests must pass unchanged).
- Templates never call AI at runtime.
- A template fills a position only where it is empty (no profile rows / no job ad). A filled position is never changed.
- Content rules: 2 stages per role (3 for the four German teacher roles), about 20-30 minutes (teacher roles up to 45); behavioural and situational questions; at least one realistic work sample per role; every open question has TR and EN prompt, 1-2 competencies, 2-4 expected behaviours and 1-3 red flags (both plain Turkish strings, team language), answer examples for 1/3/5; choice questions have exactly one correct option (SINGLE_CHOICE), plausible distractors and no competency. Each template has exactly 3 weighted competencies, whole numbers adding up to 100.
- Never ask about age, family, marital status, children, religion, health, pregnancy, disability, origin or politics.
- Candidate copy in "sen" form. Never the em-dash character (U+2014) anywhere: code, copy, comments, commit messages.
- Copy keys in both `src/i18n/messages/hiring.tr.json` and `hiring.en.json` (`src/i18n/messages.test.ts` checks parity; `src/i18n/panel-copy.test.ts` checks "sen" form).
- Less AI (user rule): the template card is first and carries "Önerilen"; the AI card gets no badge, no sparkles.
- Code, comments and commits in English. Exact-path `git add`. Branch `platform/solutions`, never main. Commit message ends with the attribution lines of the session running the task.
- Gates per task: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, the task's tests (`pnpm exec vitest run <files>`). Task 10 runs full `pnpm test` and `pnpm build`.
- Never touch the shared DB `kademe`, production or the VM. DB scripts only on a throw-away database whose name ends in `_check`.
- Browser checks only with Claude in Chrome (`mcp__claude-in-chrome__*`), never Playwright.

---

## File Structure

Created:
- `src/solutions/hiring/templates/types.ts`: `HiringTemplate`, `TemplateStage`, `TemplateActivity`, `TemplateGroup`.
- `src/solutions/hiring/templates/build.ts`: builders `t, video, audio, longText, shortText, fileUpload, single, stage`.
- `src/solutions/hiring/templates/competencies.ts`: `TEMPLATE_COMPETENCIES`, `templateCompetency(key)`; the 8 starter ones from `SEED_COMPETENCIES` plus 8 new ones.
- `src/solutions/hiring/templates/materialise.ts`: `materialise(template, idOf)` (pure), `templateMinutes`, `templateQuestionCount`.
- `src/solutions/hiring/templates/index.ts`: `TEMPLATES`, `templateByKey`, `matchTemplate`.
- `src/solutions/hiring/templates/roles/*.ts`: one file per role (20).
- `src/solutions/hiring/templates/templates.test.ts`: the validation test over every template.
- `src/solutions/hiring/server/templates.ts`: `ensureTemplateCompetencies`, `templateCards`.
- `src/solutions/hiring/server/templates.test.ts`.
- `src/components/hiring/template-gallery.tsx` (+ `.test.ts`): gallery cards and preview Sheet.
- `scripts/verify-hiring-templates.ts`, script `verify:hiring-templates` in `package.json`.
- `docs/superpowers/ledgers/2026-10-06-hiring-ready-templates/progress.md` (controller).

Modified:
- `src/db/library-seed.ts`: `ensureDefaultScale(orgId, x = db)`.
- `src/solutions/hiring/server/versions.ts`: export `insertStageRows`.
- `src/solutions/hiring/server/openings.ts` (+ test): TEMPLATE start.
- `src/app/(manager)/hiring/openings/new/actions.ts`, `page.tsx`.
- `src/components/hiring/start-choices.ts` (+ test), `new-opening-steps.ts` (+ test), `new-opening-form.tsx`.
- `src/i18n/messages/hiring.tr.json`, `hiring.en.json`.
- `docs/STATUS.md` (Task 10).

---

### Task 1: Template types, builders, competencies and the validation test

**Files:**
- Create: `src/solutions/hiring/templates/{types,build,competencies,materialise,index}.ts`, `src/solutions/hiring/templates/roles/customer-support.ts`, `src/solutions/hiring/templates/templates.test.ts`

**Interfaces:**
- Consumes: `ActivityPayload`, `StagePayload`, `activityPayloadSchema`, `stagePayloadSchema` from `src/solutions/hiring/rules/patches.ts`; `CompetencySeed`, `SEED_COMPETENCIES` from `src/db/library-seed-data.ts`; `publishProblems` from `src/solutions/hiring/rules/gate.ts`; `VersionContent`, `CompetencyFacts`, `isChoice` from `src/solutions/hiring/rules/content.ts`.
- Produces:
  - `type TemplateActivity = Omit<ActivityPayload, "competencyIds"> & { competencyKeys: string[] }`
  - `type TemplateStage = Omit<StagePayload, "activities"> & { activities: TemplateActivity[] }`
  - `type TemplateGroup = "GENERIC" | "LANGUAGE_SCHOOL" | "EXTRA"`
  - `type HiringTemplate = { key: string; group: TemplateGroup; name: I18nText; summary: I18nText; jobAd: I18nText; weights: Record<string, number>; stages: TemplateStage[] }`
  - `TEMPLATE_COMPETENCIES: CompetencySeed[]`, `templateCompetency(key: string): CompetencySeed | undefined`
  - `materialise(template: HiringTemplate, idOf: (key: string) => string): { stages: StagePayload[]; weights: Record<string, number> }`
  - `templateMinutes(t: HiringTemplate): number` (sum of stage `durationSeconds` / 60), `templateQuestionCount(t): number`
  - `TEMPLATES: HiringTemplate[]` (gallery order), `templateByKey(key: string): HiringTemplate | null`, `matchTemplate(positionName: string): HiringTemplate | null` (trimmed, `toLocaleLowerCase("tr")` equality with the TR or EN name)

- [ ] **Step 1: Write `types.ts` and `build.ts`**

```ts
// src/solutions/hiring/templates/types.ts
import type { I18nText } from "@/db/schema/types";
import type { ActivityPayload, StagePayload } from "../rules/patches";

/** A question as a template states it: competencies by library key, never by id. */
export type TemplateActivity = Omit<ActivityPayload, "competencyIds"> & { competencyKeys: string[] };
export type TemplateStage = Omit<StagePayload, "activities"> & { activities: TemplateActivity[] };
export type TemplateGroup = "GENERIC" | "LANGUAGE_SCHOOL" | "EXTRA";

/** A ready assessment for one role (spec 2026-10-06-hiring-ready-templates-design, section 3). */
export type HiringTemplate = {
  key: string;
  group: TemplateGroup;
  name: I18nText;
  /** One line for the gallery card. */
  summary: I18nText;
  /** Written into a position that has no job ad yet. */
  jobAd: I18nText;
  /** Competency key to whole percentage; exactly the competencies the open questions measure, summing to 100. */
  weights: Record<string, number>;
  stages: TemplateStage[];
};
```

```ts
// src/solutions/hiring/templates/build.ts
import type { AnswerExamples } from "@/db/schema/hiring";
import type { I18nText } from "@/db/schema/types";
import type { TemplateActivity, TemplateStage } from "./types";

export const t = (tr: string, en: string): I18nText => ({ tr, en });

type Open = {
  prompt: I18nText;
  note?: I18nText;
  competencies: string[];
  /** Team language (Turkish), 2-4 items. */
  expected: string[];
  /** Team language (Turkish), 1-3 items. */
  redFlags: string[];
  examples: AnswerExamples;
  internal?: string;
};

const open = (o: Open) => ({
  required: true,
  prompt: o.prompt,
  note: o.note ?? t("", ""),
  internalQuestion: o.internal ?? null,
  expectedBehaviours: o.expected,
  redFlags: o.redFlags,
  managerNotes: null,
  answerExamples: o.examples,
  competencyKeys: o.competencies,
});

type Recorded = Open & { think?: number; answer?: number; takes?: number };

export const video = (o: Recorded): TemplateActivity => ({
  ...open(o),
  type: "VIDEO",
  thinkSeconds: o.think ?? 60,
  flexibleThink: true,
  answerSeconds: o.answer ?? 120,
  maxTakes: o.takes ?? 2,
  config: { textAlternativeEnabled: false },
});

export const audio = (o: Recorded): TemplateActivity => ({ ...video(o), type: "AUDIO" });

export const longText = (o: Open & { minChars?: number; maxChars?: number }): TemplateActivity => ({
  ...open(o),
  type: "LONG_TEXT",
  thinkSeconds: 0,
  flexibleThink: true,
  answerSeconds: null,
  maxTakes: 1,
  config: { minChars: o.minChars ?? 300, maxChars: o.maxChars ?? 3000 },
});

export const shortText = (o: Open & { maxChars?: number }): TemplateActivity => ({
  ...longText(o),
  type: "SHORT_TEXT",
  config: { minChars: 0, maxChars: o.maxChars ?? 300 },
});

export const fileUpload = (o: Open & { mimeTypes: string[] }): TemplateActivity => ({
  ...open(o),
  type: "FILE_UPLOAD",
  thinkSeconds: 0,
  flexibleThink: true,
  answerSeconds: null,
  maxTakes: 1,
  config: { acceptedMimeTypes: o.mimeTypes, maxFileBytes: 20 * 1024 * 1024 },
});

/** A knowledge check with one right answer. It measures no competency (gate rule CHOICE_WITH_COMPETENCY). */
export const single = (o: { prompt: I18nText; note?: I18nText; options: I18nText[]; correct: number; internal?: string }): TemplateActivity => ({
  required: true,
  type: "SINGLE_CHOICE",
  prompt: o.prompt,
  note: o.note ?? t("", ""),
  internalQuestion: o.internal ?? null,
  expectedBehaviours: [],
  redFlags: [],
  managerNotes: null,
  answerExamples: {},
  thinkSeconds: 0,
  flexibleThink: true,
  answerSeconds: null,
  maxTakes: 1,
  config: { choices: o.options.map((label, i) => ({ id: String.fromCharCode(97 + i), label, ...(i === o.correct ? { correct: true } : {}) })) },
  competencyKeys: [],
});

export const stage = (s: { name: I18nText; description: I18nText; purpose: string; minutes: number; activities: TemplateActivity[] }): TemplateStage => ({
  name: s.name,
  description: s.description,
  internalPurpose: s.purpose,
  durationSeconds: s.minutes * 60,
  graceSeconds: 0,
  onTimeout: "AUTO_SUBMIT",
  backNavigation: false,
  activities: s.activities,
});
```

Check `AnswerExamples` is exported from `src/db/schema/hiring.ts` (it is declared there as `export type AnswerExamples`); if the import path differs, import it from where `ContentActivity` imports it.

- [ ] **Step 2: Write `competencies.ts`**

`TEMPLATE_COMPETENCIES = [...SEED_COMPETENCIES, ...NEW]`, where `NEW` has these 8 entries, each a full `CompetencySeed` (key, name, description, anchors 1/3/5, 3-4 positive and 3-4 negative observation tags), TR and EN, anchors describing what a reviewer observes in an answer, never a trait (same style as `src/db/library-seed-data.ts`):

| key | TR name | EN name | what it covers |
|---|---|---|---|
| `accuracy` | Doğruluk ve titizlik | Accuracy and care | finds and fixes errors, checks numbers and records |
| `didactics` | Öğretim becerisi | Teaching skill | plans a lesson, explains to the learner's level, checks understanding |
| `german_proficiency` | Almanca yeterliği | German proficiency | 1 = below B2: frequent errors block meaning, limited range; 3 = C1: fluent, wide range, rare errors, right register; 5 = C2-like: precise, idiomatic, near-native control. Read `src/lib/exam/cefr-descriptors.ts` for the level contrasts |
| `resilience` | Baskı altında sakinlik | Composure under pressure | stays calm and polite under repeated pressure, recovers |
| `integrity` | Dürüstlük ve gizlilik | Integrity and confidentiality | refuses improper requests, protects personal data |
| `design_craft` | Tasarım zanaatı | Design craft | user research, clear flows, accessible interfaces |
| `classroom_management` | Sınıf yönetimi | Classroom management | keeps a group engaged, handles disruption, includes quiet learners |
| `exam_expertise` | Sınav bilgisi | Exam expertise | knows Goethe/telc/ÖSD formats, criteria and rules |

`templateCompetency(key)` returns the entry or `undefined`.

- [ ] **Step 3: Write `materialise.ts` and `index.ts`**

```ts
// src/solutions/hiring/templates/materialise.ts
import type { StagePayload } from "../rules/patches";
import type { HiringTemplate } from "./types";

/** The template as builder payloads: competency keys become the organisation's ids. */
export function materialise(template: HiringTemplate, idOf: (key: string) => string): { stages: StagePayload[]; weights: Record<string, number> } {
  const stages = template.stages.map(({ activities, ...stage }) => ({
    ...stage,
    activities: activities.map(({ competencyKeys, ...activity }) => ({ ...activity, competencyIds: competencyKeys.map(idOf) })),
  }));
  const weights = Object.fromEntries(Object.entries(template.weights).map(([key, w]) => [idOf(key), w]));
  return { stages, weights };
}

export const templateMinutes = (template: HiringTemplate) => Math.round(template.stages.reduce((s, x) => s + x.durationSeconds, 0) / 60);
export const templateQuestionCount = (template: HiringTemplate) => template.stages.reduce((s, x) => s + x.activities.length, 0);

/** Every competency key the template uses: open questions first, then weights. */
export function templateCompetencyKeys(template: HiringTemplate): string[] {
  const keys = template.stages.flatMap((s) => s.activities.flatMap((a) => a.competencyKeys));
  return [...new Set([...keys, ...Object.keys(template.weights)])];
}
```

```ts
// src/solutions/hiring/templates/index.ts
import { customerSupport } from "./roles/customer-support";
import type { HiringTemplate } from "./types";

/** Gallery order: generic roles, then language-school roles, then the extra roles. */
export const TEMPLATES: HiringTemplate[] = [customerSupport];

export const templateByKey = (key: string): HiringTemplate | null => TEMPLATES.find((x) => x.key === key) ?? null;

const norm = (s: string) => s.trim().toLocaleLowerCase("tr");
/** A position whose name is a template's name (TR or EN) preselects that template. */
export function matchTemplate(positionName: string): HiringTemplate | null {
  const wanted = norm(positionName);
  if (!wanted) return null;
  return TEMPLATES.find((x) => norm(x.name.tr) === wanted || norm(x.name.en) === wanted) ?? null;
}
```

- [ ] **Step 4: Write the worked example `roles/customer-support.ts`**

This file is the reference every content task copies the shape and quality of.

```ts
import { longText, single, stage, t, video } from "../build";
import type { HiringTemplate } from "../types";

export const customerSupport: HiringTemplate = {
  key: "customer-support",
  group: "GENERIC",
  name: t("Müşteri Destek Uzmanı", "Customer Support Specialist"),
  summary: t("Zor müşteri, net yazılı cevap ve sorun önceliklendirme.", "Difficult customers, clear written replies and issue triage."),
  jobAd: t(
    "Müşterilerimizin telefon, e-posta ve canlı destek taleplerini karşılayacak, sorunları ilk temasta çözmeye çalışacak ve çözülemeyenleri doğru ekibe aktaracak bir Müşteri Destek Uzmanı arıyoruz. Sakin, net yazan ve sorunun kökünü merak eden biri olmalısın.",
    "We are looking for a Customer Support Specialist who answers our customers by phone, e-mail and live chat, tries to solve issues on first contact and hands the rest to the right team. You stay calm, write clearly and want to find the root of a problem.",
  ),
  weights: { customer: 40, communication: 35, problem_solving: 25 },
  stages: [
    stage({
      name: t("Kısa tanışma", "Short introduction"),
      description: t("İki kısa video sorusu ve bir senaryo sorusu. Yaklaşık 10 dakika.", "Two short video questions and one scenario question. About 10 minutes."),
      purpose: "Gerçek bir zor müşteri deneyimi ve iade politikası muhakemesi.",
      minutes: 10,
      activities: [
        video({
          prompt: t(
            "Öfkeli ya da hayal kırıklığına uğramış bir müşteriyle konuştuğun son bir durumu anlat: müşteri neden kızgındı, sen tam olarak ne söyledin ve ne yaptın, sonuç ne oldu?",
            "Tell us about a recent time you spoke with an angry or disappointed customer: why were they upset, what exactly did you say and do, and what was the result?",
          ),
          competencies: ["customer", "communication"],
          expected: [
            "Müşterinin duygusunu adıyla karşılıyor",
            "Sorunu kendi sözleriyle özetleyip doğruluyor",
            "Somut bir sonraki adım ve zaman veriyor",
            "Sonucu ve kendi payını net söylüyor",
          ],
          redFlags: ["Müşteriyi suçluyor ya da küçümsüyor", "Somut bir olay yerine genel laflar ediyor"],
          examples: {
            1: "Müşteriler genelde abartıyor, kurallar neyse onu söylerim.",
            3: "Kargosu geciken bir müşteriyi dinledim, durumu kargo firmasından öğrenip aynı gün geri aradım, ürün ertesi gün ulaştı.",
            5: "Önce 'haklısınız, bu bekleme can sıkıcı' dedim, siparişi açıp gecikmenin nedenini buldum, saat vererek geri döneceğimi söyledim ve döndüm; sonra aynı sorunun tekrarlanmaması için ekibe not bıraktım.",
          },
        }),
        video({
          prompt: t(
            "Bir müşterinin sorusunun cevabını bilmediğin bir anı anlat. Nasıl ilerledin, kime ne sordun ve bu sürede müşteriye ne söyledin?",
            "Tell us about a moment when you did not know the answer to a customer's question. How did you proceed, whom did you ask what, and what did you tell the customer meanwhile?",
          ),
          competencies: ["problem_solving", "customer"],
          expected: ["Bilmediğini açıkça kabul ediyor", "Doğru kaynağa ya da kişiye gidiyor", "Müşteriye ne zaman döneceğini söylüyor"],
          redFlags: ["Tahminle yanlış bilgi verdiğini anlatıyor", "Müşteriyi bekletip haber vermiyor"],
          examples: {
            1: "Aklıma gelen bir şey söyledim, müşteri sonra tekrar aradı.",
            3: "Müşteriye kontrol edip döneceğimi söyledim, ürün ekibine sordum ve aynı gün cevap verdim.",
            5: "Bilmediğimi söyleyip 30 dakika içinde döneceğimi belirttim, bilgi tabanında ve ürün ekibinde kontrol ettim, cevabı verdikten sonra eksik bilgiyi bilgi tabanına ekletiyorum.",
          },
        }),
        single({
          prompt: t(
            "Bir müşteri, 30 günlük iade süresi 3 gün önce dolmuş bir ürünü iade etmek istiyor ve çok kızgın. Politikaya göre istisnayı yalnızca ekip lideri onaylayabiliyor. En doğru ilk adım hangisi?",
            "A customer wants to return a product whose 30-day return window ended 3 days ago, and they are very angry. By policy only the team lead can approve an exception. What is the best first step?",
          ),
          options: [
            t("Politikayı okuyup iadenin mümkün olmadığını söylemek", "Read out the policy and say a return is not possible"),
            t("Dinleyip durumu özetlemek, istisna için ekip liderine danışacağını ve ne zaman döneceğini söylemek", "Listen, summarise, say you will ask the team lead about an exception and when you will get back"),
            t("Müşteri memnun kalsın diye iadeyi hemen kabul etmek", "Accept the return at once so the customer is happy"),
            t("Müşteriyi hiçbir şey söylemeden ekip liderine aktarmak", "Transfer the customer to the team lead without saying anything"),
          ],
          correct: 1,
        }),
      ],
    }),
    stage({
      name: t("İş örneği", "Work sample"),
      description: t("Gerçek işe benzeyen iki yazılı görev. Yaklaşık 20 dakika.", "Two written tasks like the real job. About 20 minutes."),
      purpose: "Yazılı müşteri iletişimi ve birden çok şikayette önceliklendirme.",
      minutes: 20,
      activities: [
        longText({
          prompt: t(
            "Aşağıdaki e-postaya müşteriye gidecek cevabı yaz.\n\n\"Üç gündür siparişim kargoda bekliyor, iki kez aradım kimse dönmedi. Yarın doğum günü hediyesi olarak vermem gerekiyordu. Paramı geri istiyorum!\"\n\nBildiklerin: kargo firması aktarma merkezinde gecikme bildirdi, tahmini teslim yarın 18:00. Ücretsiz kargo kodu verme yetkin var. İade ancak teslimattan sonra yapılabiliyor.",
            "Write the reply that goes to the customer for the e-mail below.\n\n\"My order has been stuck in shipping for three days, I called twice and nobody called back. It was meant to be a birthday present tomorrow. I want my money back!\"\n\nWhat you know: the carrier reported a delay at the transfer hub, estimated delivery tomorrow 18:00. You may give a free-shipping code. A refund is only possible after delivery.",
          ),
          competencies: ["customer", "communication"],
          expected: [
            "Özür ve anlayışla açılıyor, dönülmeyen aramaları sahipleniyor",
            "Tahmini teslim saatini ve iade kuralını açık söylüyor",
            "Yetkisi içindeki telafiyi (kargo kodu) sunuyor",
            "Kısa, kibar, kalıp cümlesiz bir dil kullanıyor",
          ],
          redFlags: ["Yetkisi olmayan bir iade ya da tarih sözü veriyor", "Kuralı müşteriyi suçlayan bir dille anlatıyor"],
          examples: {
            1: "Sayın müşterimiz, iade teslimattan sonra yapılır. İyi günler.",
            3: "Geciktiğimiz için özür dilerim. Kargo firması aktarma merkezinde gecikme bildirdi, siparişiniz yarın 18:00'e kadar elinizde olacak. Teslimattan sonra isterseniz iade başlatabilirim.",
            5: "Haklı olarak sinirlendiniz, aramalarınıza dönmediğimiz için de özür dilerim. Siparişiniz aktarma merkezinde gecikmiş, tahmini teslim yarın 18:00. Takibini ben yapacağım ve yarın öğlen size durumu yazacağım. Telafi olarak bir sonraki siparişiniz için ücretsiz kargo kodu ekledim. Ürün yetişmezse teslimatta iadeyi hemen başlatırım.",
          },
        }),
        longText({
          prompt: t(
            "Bu sabah üç müşteriden aynı şikayet geldi: mobil uygulamada ödeme adımında \"işlem başarısız\" hatası alıyorlar ama kartlarından para çekilmiş görünüyor. İlk 30 dakikada atacağın adımları sırayla yaz: kime neyi bildirirsin, müşterilere ne söylersin, neyi kayıt altına alırsın?",
            "This morning three customers sent the same complaint: the mobile app shows \"payment failed\" at checkout, but money seems to have left their card. Write the steps you take in the first 30 minutes, in order: whom do you tell what, what do you say to the customers, what do you record?",
          ),
          competencies: ["problem_solving", "communication"],
          expected: [
            "Bunu tekil değil olası bir sistem hatası olarak görüyor",
            "Teknik ekibe örneklerle (sipariş no, saat, cihaz) hızlı bildiriyor",
            "Müşterilere çift ödeme olmayacağını ya da iade edileceğini doğrulamadan söz vermiyor, ne zaman döneceğini söylüyor",
            "Gelen yeni şikayetler için ortak bir kayıt ya da hazır cevap açıyor",
          ],
          redFlags: ["Her müşteriye ayrı ayrı tekrar denemesini söyleyip bırakıyor", "Teknik ekibe haber vermiyor"],
          examples: {
            1: "Müşterilere tekrar denemelerini söylerim.",
            3: "Teknik ekibe üç örneği iletirim, müşterilere sorunu incelediğimizi ve gün içinde döneceğimizi yazarım.",
            5: "Önce son bir saatteki benzer talepleri tararım, üç örneği sipariş no ve saatle teknik ekibe acil diye açarım, ödeme ekibine çekilen tutarları sorarım. Müşterilere incelediğimizi, ödeme doğrulanınca iadenin otomatik olacağını ve saat 12'de güncelleme vereceğimi yazarım; ekip için tek bir kayıt ve hazır cevap açarım.",
          },
        }),
      ],
    }),
  ],
};
```

- [ ] **Step 5: Write the failing validation test `templates.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { publishProblems } from "../rules/gate";
import { isChoice, type CompetencyFacts, type VersionContent } from "../rules/content";
import { activityPayloadSchema, stagePayloadSchema } from "../rules/patches";
import { templateCompetency } from "./competencies";
import { TEMPLATES, matchTemplate, templateByKey } from "./index";
import { materialise, templateCompetencyKeys, templateMinutes } from "./materialise";

/** A stable fake uuid per competency key, so the payload schemas accept it. */
const idOf = (key: string) => {
  const hex = [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${hex}`;
};

const EM_DASH = String.fromCharCode(0x2014);
const BANNED = ["kaç yaşında", "yaşınız", "evli mi", "çocuğun var", "dinin", "hamile", "engelin var", "sağlık sorunun", "nerelisin", "how old", "married", "religion", "pregnan", "disabilit", "where are you from"];

function contentOf(template: (typeof TEMPLATES)[number]): VersionContent {
  const { stages, weights } = materialise(template, idOf);
  return {
    id: "v",
    number: 1,
    status: "DRAFT",
    defaultLocale: "tr",
    localeSet: ["tr", "en"],
    weightsEnabled: true,
    draftWeights: weights,
    previewedAt: null,
    stages: stages.map((s, si) => ({ ...s, id: `s${si}`, orderIndex: si, activities: s.activities.map((a, ai) => ({ ...a, id: `s${si}a${ai}`, orderIndex: ai })) })),
  } as VersionContent;
}

function factsOf(template: (typeof TEMPLATES)[number]): Map<string, CompetencyFacts> {
  return new Map(
    templateCompetencyKeys(template).map((key) => {
      const c = templateCompetency(key)!;
      return [idOf(key), { id: idOf(key), name: c.name, description: c.description, archived: false, anchors: c.anchors, tags: [] }];
    }),
  );
}

describe("ready templates", () => {
  it("have unique keys and are found by key and by name", () => {
    expect(new Set(TEMPLATES.map((x) => x.key)).size).toBe(TEMPLATES.length);
    for (const x of TEMPLATES) {
      expect(templateByKey(x.key)).toBe(x);
      expect(matchTemplate(` ${x.name.tr.toLocaleUpperCase("tr")} `)).toBe(x);
    }
    expect(templateByKey("nope")).toBeNull();
  });

  for (const template of TEMPLATES) {
    describe(template.key, () => {
      it("passes every publish gate", () => {
        expect(publishProblems(contentOf(template), factsOf(template))).toEqual([]);
      });

      it("validates as builder payloads", () => {
        for (const s of materialise(template, idOf).stages) {
          expect(stagePayloadSchema.safeParse(s).success).toBe(true);
          for (const a of s.activities) expect(activityPayloadSchema.safeParse(a).success).toBe(true);
        }
      });

      it("weights exactly its 3 measured competencies with whole numbers adding up to 100", () => {
        const measured = new Set(template.stages.flatMap((s) => s.activities.flatMap((a) => a.competencyKeys)));
        expect(Object.keys(template.weights).sort()).toEqual([...measured].sort());
        expect(measured.size).toBe(3);
        expect(Object.values(template.weights).every((w) => Number.isInteger(w) && w > 0)).toBe(true);
        expect(Object.values(template.weights).reduce((a, b) => a + b, 0)).toBe(100);
        for (const key of measured) expect(templateCompetency(key), key).toBeDefined();
      });

      it("meets the content bar", () => {
        const teacher = template.stages.length === 3;
        expect(template.stages.length).toBe(teacher ? 3 : 2);
        const minutes = templateMinutes(template);
        expect(minutes).toBeGreaterThanOrEqual(15);
        expect(minutes).toBeLessThanOrEqual(teacher ? 45 : 35);
        for (const s of template.stages) {
          expect(s.name.tr && s.name.en && s.description.tr && s.description.en).toBeTruthy();
          for (const a of s.activities) {
            expect(a.prompt.tr.trim() && a.prompt.en.trim()).toBeTruthy();
            if (isChoice(a.type)) {
              expect(a.config.choices!.length).toBeGreaterThanOrEqual(3);
              expect(a.config.choices!.filter((c) => c.correct)).toHaveLength(1);
              expect(a.config.choices!.every((c) => c.label.tr && c.label.en)).toBe(true);
            } else {
              expect(a.competencyKeys.length).toBeGreaterThanOrEqual(1);
              expect(a.competencyKeys.length).toBeLessThanOrEqual(2);
              expect(a.expectedBehaviours.length).toBeGreaterThanOrEqual(2);
              expect(a.expectedBehaviours.length).toBeLessThanOrEqual(4);
              expect(a.redFlags.length).toBeGreaterThanOrEqual(1);
              expect(a.redFlags.length).toBeLessThanOrEqual(3);
              expect(a.answerExamples[1] && a.answerExamples[3] && a.answerExamples[5]).toBeTruthy();
            }
          }
          expect(s.activities.some((a) => !isChoice(a.type))).toBe(true);
        }
      });

      it("has no em-dash and no question a hiring law forbids", () => {
        const text = JSON.stringify(template);
        expect(text.includes(EM_DASH)).toBe(false);
        const lower = text.toLocaleLowerCase("tr");
        for (const word of BANNED) expect(lower.includes(word), word).toBe(false);
      });
    });
  }

  it("every template competency has anchors 1, 3 and 5 in both languages and no em-dash", async () => {
    const { TEMPLATE_COMPETENCIES } = await import("./competencies");
    expect(new Set(TEMPLATE_COMPETENCIES.map((c) => c.key)).size).toBe(TEMPLATE_COMPETENCIES.length);
    for (const c of TEMPLATE_COMPETENCIES) {
      for (const level of [1, 3, 5] as const) expect(c.anchors[level].tr && c.anchors[level].en, `${c.key} ${level}`).toBeTruthy();
      expect(JSON.stringify(c).includes(EM_DASH)).toBe(false);
    }
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run src/solutions/hiring/templates`
Expected: all PASS. If "passes every publish gate" fails, print the problems and fix the template, not the test. Then run the em-dash check on the new files: `grep -rl "$(printf '\xe2\x80\x94')" src/solutions/hiring/templates` (expect no output).

- [ ] **Step 7: tsc, eslint, commit**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint src/solutions/hiring/templates
git add src/solutions/hiring/templates
git commit -m "Add the ready template model, its competencies and the customer support template"
```

---

### Task 2: Create an opening from a template on the server

**Files:**
- Modify: `src/db/library-seed.ts` (`ensureDefaultScale(orgId, x = db)`), `src/solutions/hiring/server/versions.ts` (export `insertStageRows`), `src/solutions/hiring/server/openings.ts`, `src/app/(manager)/hiring/openings/new/actions.ts`
- Create: `src/solutions/hiring/server/templates.ts`, `src/solutions/hiring/server/templates.test.ts`
- Test: `src/solutions/hiring/server/openings.test.ts`

**Interfaces:**
- Consumes: Task 1's `templateByKey`, `templateCompetency`, `templateCompetencyKeys`, `materialise`, `TEMPLATES`, `templateMinutes`, `templateQuestionCount`.
- Produces:
  - `ensureTemplateCompetencies(x: Executor, orgId: string, actorId: string, keys: string[]): Promise<Record<string, string>>` (key to competency id)
  - `CreateOpeningInput.start: "AI" | "COPY" | "BLANK" | "TEMPLATE"`, `CreateOpeningInput.templateKey?: string | null`
  - refusal code `"TEMPLATE_NOT_FOUND"` in `CreateOpeningResult`
  - `type TemplateCard = { key: string; group: TemplateGroup; name: string; summary: string; stageCount: number; questionCount: number; minutes: number; competencies: string[]; stages: Array<{ name: string; prompts: string[] }> }` and `templateCards(locale: Locale): TemplateCard[]` (competency names in that locale, highest weight first; stage prompts are the candidate-facing prompt texts)

Behaviour of `ensureTemplateCompetencies`, per key, in order (spec section 4.1):
1. A row of the organisation with `seed_key = key`: use it. If `archived_at` is set, clear it (`archived_at = null`, `updated_at = now`) and write an audit row (`action: "library.competency.restore"`, `meta: { via: "hiring.template" }`); read `audit()` in `src/server/library-write.ts` and use it with the executor.
2. Else an active row whose TR or EN name equals the template name's TR or EN (trimmed, `toLocaleLowerCase("tr")`): use it.
3. Else insert a competency (`orgId`, `name`, `description`, `scaleId` from `ensureDefaultScale(orgId, x)`, `seedKey: key`, `reviewedAt: null`), its anchors 1/3/5 and observation tags (positive then negative, `orderIndex` 0..n), and an audit row `library.competency.create` with `meta: { via: "hiring.template" }`.
4. For a reused row, insert the template's anchor text only for missing levels among 1, 3, 5 (`competency_anchors` unique on `(competency_id, value)`: use `onConflictDoNothing`).
A key with no `templateCompetency` throws `Error("unknown template competency <key>")` (a programming error; Task 1's test prevents it).

Changes in `createOpening` (keep every existing check and its order; add):
- Right after the creator check: `const template = input.start === "TEMPLATE" ? templateByKey(input.templateKey ?? "") : null; if (input.start === "TEMPLATE" && !template) return { ok: false, code: "TEMPLATE_NOT_FOUND" };` (before any write).
- A new position with an empty job ad and a template: create it with `template.jobAd[DEFAULT_LOCALE]`.
- An existing position with an empty job ad (`null` or blank) and a template: `update positions set job_description = <ad>, updated_at = now where id and org_id and (job_description is null or btrim(job_description) = '')`.
- After the opening row: `const ids = template ? await ensureTemplateCompetencies(tx, user.orgId, user.id, templateCompetencyKeys(template)) : null; const built = template ? materialise(template, (k) => ids![k]) : null;`
- The version insert gets `...(built ? { weightsEnabled: true, draftWeights: built.weights } : {})`.
- After the version insert: `if (built) for (const [i, s] of built.stages.entries()) await insertStageRows(tx, version.id, i, s);`
- Profile: when a template is used and the position has no `position_competencies` rows, insert one per weight (`weight` = the template weight, `orderIndex` by weight descending).
- Audit meta: `{ positionId, start, copyFrom: start === "COPY" ? copyFrom : null, templateKey: start === "TEMPLATE" ? template.key : null }`.
- `next` for TEMPLATE is the builder `/assessment/edit`.

Action: `start: z.enum(["AI", "COPY", "BLANK", "TEMPLATE"])`, `templateKey: z.string().max(80).nullable().optional()`.

- [ ] **Step 1: Write failing tests in `openings.test.ts`** (same fake DB style as the existing `createOpening` block; read it first):
  - TEMPLATE with an unknown key returns `TEMPLATE_NOT_FOUND` and records no insert/update op (`writesOf(fake.ops)` empty).
  - TEMPLATE `customer-support` on an existing position: inserts `hiring_stages` 2 rows, `hiring_activities` 5 rows, `hiring_activity_competencies` rows only for the 4 open questions; the `hiring_versions` insert has `weights_enabled = true` and `draft_weights` with 3 entries summing to 100; the audit row's meta has `templateKey: "customer-support"`; `next` ends with `/assessment/edit`.
  - A position that already has a job ad gets no `positions` update; one without gets exactly one update whose params contain the template ad.
  - A position with profile rows gets no `position_competencies` insert.
  - `BLANK`, `AI`, `COPY` cases: unchanged expectations (existing tests pass untouched).
- [ ] **Step 2: Write failing tests in `server/templates.test.ts`** for `ensureTemplateCompetencies`: seed-key hit (no insert), archived seed-key hit (one update clearing `archived_at` + one audit insert), name hit (no competency insert, missing anchors inserted with on-conflict-do-nothing), miss (competency insert with `seed_key`, `reviewed_at` null, 3 anchors, tags, audit). And `templateCards("tr")`: one card per template, `competencies` sorted by weight, `minutes` = `templateMinutes`.
- [ ] **Step 3: Run them, expect FAIL** (`pnpm exec vitest run src/solutions/hiring/server/openings.test.ts src/solutions/hiring/server/templates.test.ts`).
- [ ] **Step 4: Implement** as described above. `ensureDefaultScale(orgId, x = db)`: replace `db` by `x` in both reads and use `x.transaction(...)` for the insert (inside a transaction drizzle opens a savepoint). Existing callers pass nothing and keep their behaviour.
- [ ] **Step 5: Run the tests, expect PASS**; then `pnpm exec vitest run src/solutions/hiring src/db src/app/\(manager\)/hiring` to see nothing else moved.
- [ ] **Step 6: tsc, eslint, commit**

```bash
git add src/db/library-seed.ts src/solutions/hiring/server/versions.ts src/solutions/hiring/server/openings.ts src/solutions/hiring/server/openings.test.ts src/solutions/hiring/server/templates.ts src/solutions/hiring/server/templates.test.ts "src/app/(manager)/hiring/openings/new/actions.ts"
git commit -m "Create an opening from a ready template with its competencies, weights and an empty position filled"
```

---

### Tasks 3-7: Template content (four roles per task)

Each content task writes four files in `src/solutions/hiring/templates/roles/`, adds them to `TEMPLATES` in `index.ts` in the order given, and makes `pnpm exec vitest run src/solutions/hiring/templates` pass. Use the Task 1 builders and match `customer-support.ts` in shape, tone and depth. Read the Global Constraints content rules first.

Per template:
- `key` kebab-case English, `group` as listed, `name`, one-line `summary`, a 2-3 sentence `jobAd` (TR and EN, "sen" form in TR).
- 3 competencies and weights (the role's first listed competency gets the largest weight, e.g. 40/35/25).
- Stage 1 "Kısa tanışma" / "Short introduction" (8-10 min): 2 behavioural recorded questions ("... bir durumu anlat: ne oldu, sen ne yaptın, sonuç ne oldu?") + 1-2 single-choice knowledge/judgement questions.
- Stage 2 "İş örneği" / "Work sample" (12-20 min): 2 realistic tasks with the concrete material inside the prompt (an e-mail, numbers, a table as text, a code snippet, a schedule).
- Every open question: expected behaviours specific to that question (not generic), red flags, answer examples for 1, 3, 5 that a reviewer can compare against.
- Single-choice: 4 options, one correct, distractors that a weaker candidate would really pick; vary the correct index across questions.
- Recorded questions: VIDEO by default; AUDIO for phone roles (call centre, course advisor phone call, sales objection).
- Steps: write the four files, register them, run the template tests, run the em-dash grep, tsc, eslint, commit (`git add` the four role files and `index.ts`).

#### Task 3: Generic roles 1 (group `GENERIC`)
1. `sales-representative` Satış Temsilcisi / Sales Representative (commercial, communication, initiative): video about exceeding a target; single on recognising an objection type; AUDIO 2-minute reply to "fiyatınız çok pahalı"; long text first cold e-mail to a given prospect.
2. `call-center-agent` Çağrı Merkezi Temsilcisi / Call Centre Agent (customer, resilience, communication): video on a day with many hard calls; single on call flow order (greet, verify, solve, summarise, close); AUDIO roleplay replying to a customer disputing an invoice (script of the customer in the prompt); AUDIO hold-and-transfer announcement.
3. `accountant` Muhasebe Uzmanı / Accountant (accuracy, technical, integrity): video on an error found at closing; single on a VAT calculation (state the rate and amount in the prompt, Turkish 20%); single on a journal entry; long text: a reconciliation table given as text with exactly 2 differences to find and explain; long text: reply to a manager asking to book an invoice in the wrong period.
4. `executive-assistant` Yönetici Asistanı / Executive Assistant (organisation, communication, integrity): video on a week of clashing priorities; single on a calendar clash; long text: rank 5 inbox items (given) with reasons; long text: meeting summary e-mail from given notes.

#### Task 4: Generic roles 2 (group `GENERIC`)
1. `software-developer` Yazılım Geliştirici / Software Developer (technical, problem_solving, teamwork): video on the hardest bug you debugged; single on a short TypeScript snippet's output; single on time complexity; long text: find and fix the bug in a given 10-15 line function (off-by-one or null case); long text: write a code review comment on a given diff.
2. `retail-sales-associate` Mağaza Satış Danışmanı / Retail Sales Associate (customer, commercial, teamwork): video on selling to an undecided customer; single on a till/return scenario; video: suggest an add-on product for a given purchase; video: busy Saturday, a queue and a complaint at once, what do you do.
3. `warehouse-logistics` Depo ve Lojistik Sorumlusu / Warehouse and Logistics Lead (organisation, accuracy, problem_solving): video on solving a shipment crisis; single on FIFO vs FEFO; single on a stock count difference; long text: a late supplier and 3 urgent orders (given) plan; long text: you see a safety violation on the floor, what do you do.
4. (customer-support is already done in Task 1; this task has three roles.)

#### Task 5: Language-school teacher roles (group `LANGUAGE_SCHOOL`, 3 stages each)
Competency keys: the role's three; stage 3 measures `german_proficiency` (counts as one of the three where listed).
1. `german-teacher-adult` Almanca Öğretmeni (yetişkin, genel kurs) / German Teacher (adult general courses) (didactics, german_proficiency, communication): stage 1 video on a lesson that did not work and what you changed, single on CEFR level matching of a given can-do sentence; stage 2 long text 45-minute A2 lesson plan (aim, warm-up, presentation, practice, check), video 2-minute teaching moment "Perfekt mit sein oder haben" as if to A2 learners.
2. `exam-prep-teacher` Sınav Hazırlık Öğretmeni (Goethe/telc/ÖSD) / Exam Preparation Teacher (exam_expertise, didactics, german_proficiency): stage 1 video on preparing a learner for an exam, single on Goethe B1 pass rule (60 of 100 per module); stage 2 long text: score a given B1 learner e-mail (text in the prompt, with errors) against telc criteria (task, expression, accuracy) and write feedback, video 2-minute strategy talk for Lesen Teil 2.
3. `german-teacher-young-learners` Çocuk ve Genç Almanca Öğretmeni / German Teacher for Children and Teens (classroom_management, didactics, german_proficiency): stage 1 video on handling a disruptive group, single on an age-appropriate activity; stage 2 long text: a 20-minute game-based activity for 10-12 year olds (A1 colours and clothes), long text: a parent's message complaining that the child is bored (reply).
4. `online-german-teacher` Online Almanca Öğretmeni / Online German Teacher (didactics, communication, german_proficiency): stage 1 video on keeping an online group active, single on a tool choice for a given online task; stage 2 video 2-minute interactive online lesson moment (speak to the camera as to learners), long text: a learner never turns the camera on and does not speak, plan.

Stage 3 for all four, identical shape, written once in `src/solutions/hiring/templates/german-proficiency-stage.ts` as `germanProficiencyStage(): TemplateStage` and reused:
- name "Almanca yeterlik" / "German proficiency", 12 minutes, purpose "Adayın Almanca seviyesi: hedef C1."
- 8 `single` items at B2-C1, the task sentence in German inside both prompts (instruction in TR/EN, item in German): 3 grammar (Konjunktiv II, Passiv mit Modalverb, Relativsatz mit Präposition), 3 vocabulary/collocation (Nomen-Verb-Verbindungen like "eine Entscheidung treffen"), 2 C-test style gaps written as a choice of the completed word.
- 1 `longText` (german_proficiency + communication or didactics as the role's second key; keep the template at exactly 3 competencies): a formal German e-mail to a learner's employer about attendance with 4 required content points listed, min 600 chars.
- 1 `video` (german_proficiency): 2 minutes in German, "Erklären Sie einer Kollegin, wie Sie mit sehr unterschiedlichen Niveaus in einer Gruppe umgehen."
- `german_proficiency` answer examples describe B1-ish (1), C1 (3), C2-like (5) answers.

#### Task 6: Language-school staff roles (group `LANGUAGE_SCHOOL`)
1. `course-advisor` Kurs Danışmanı (satış ve kayıt) / Course Advisor (sales and enrolment) (commercial, customer, communication): video on convincing a hesitant applicant honestly; single on matching a level-test result to a course; AUDIO phone: a parent says "başka okul daha ucuz"; long text: follow-up message to someone who missed a trial lesson.
2. `student-services` Öğrenci İşleri / Kayıt Sorumlusu / Student Services and Registration Officer (organisation, accuracy, customer): video on fixing a wrong registration; single on a missing-document check; long text: find the inconsistencies between a given payment list and class list (as text, 3 differences); long text: formal e-mail to a learner with too many absences.
3. `education-coordinator` Eğitim Koordinatörü / Education Coordinator (organisation, didactics, teamwork): video on resolving a conflict between teachers; single on a timetable clash; long text: weekly timetable proposal for 3 teachers and 5 groups (constraints given); long text: feedback plan for a teacher with learner complaints, including a level-change decision for a borderline learner.
4. `exam-centre-officer` Sınav Sorumlusu (lisanslı merkez) / Exam Centre Officer (licensed centre) (integrity, organisation, exam_expertise): video on running an event with strict rules; single on what to do when a candidate's ID does not match; long text: exam-day checklist for a 20-candidate written module; long text: you suspect a candidate of using a phone during Hören, what do you do and record.

#### Task 7: Extra roles (group `EXTRA`)
1. `hr-specialist` İnsan Kaynakları Uzmanı / HR Specialist (integrity, communication, organisation): video on handling a confidential matter; single on which interview question must not be asked; long text: first 3 steps for an employee complaint (given); long text: a rejection e-mail to a finalist.
2. `marketing-specialist` Pazarlama Uzmanı / Marketing Specialist (commercial, problem_solving, communication): video on a campaign whose result you measured; single on reading CTR and CPA from given numbers; long text: two decisions from a given campaign table; long text: 3 ad texts for a new evening German course.
3. `product-designer` Ürün Tasarımcısı / Product Designer (design_craft, problem_solving, communication): video on research that changed your idea; single on an accessibility rule (contrast, focus, labels); `fileUpload` portfolio (PDF/PNG/JPG, 20 MB) with expected behaviours on process evidence; long text: find 3 problems in a sign-up form described in text and propose fixes.
4. `field-sales-representative` Saha Satış Temsilcisi / Field Sales Representative (commercial, initiative, organisation): video on winning back a lost customer; single on route prioritisation with given visits; AUDIO 2-minute pitch of a new product to a dealer; long text: weekly visit plan and targets from given accounts.

Order in `TEMPLATES` after Task 7: customer-support, sales-representative, call-center-agent, accountant, executive-assistant, software-developer, retail-sales-associate, warehouse-logistics, german-teacher-adult, exam-prep-teacher, german-teacher-young-learners, online-german-teacher, course-advisor, student-services, education-coordinator, exam-centre-officer, hr-specialist, marketing-specialist, product-designer, field-sales-representative. Task 7 adds one test: `expect(TEMPLATES).toHaveLength(20)`.

---

### Task 8: The template card and the gallery step

**Files:**
- Modify: `src/components/hiring/start-choices.ts` (+ test), `src/components/hiring/new-opening-steps.ts` (+ test), `src/components/hiring/new-opening-form.tsx`, `src/app/(manager)/hiring/openings/new/page.tsx`, `src/i18n/messages/hiring.tr.json`, `hiring.en.json`
- Create: `src/components/hiring/template-gallery.tsx`, `src/components/hiring/template-gallery.test.ts`

**Interfaces:**
- Consumes: `templateCards(locale)` and `TemplateCard` (Task 2), `matchTemplate` (Task 1), `createOpeningAction` with `start: "TEMPLATE"`, `templateKey`.
- Produces: `StartValue = "TEMPLATE" | "AI" | "COPY" | "BLANK"`; `NewOpeningStep = "position" | "ad" | "start" | "template"`; `newOpeningSteps({ newName, template })`; `createWait` returns `"needTemplate"` when start is TEMPLATE and no key is chosen; refusal `TEMPLATE_NOT_FOUND` maps to step `template`; summary part `{ key: "summaryTemplate"; name: string }`.

Behaviour:
- Start step: the TEMPLATE card is first (icon `LayoutTemplate`, title `startTemplate` "Hazır şablondan başla" / "Start from a ready template", body `startTemplateBody` "Bu rol için hazır aşamalar, sorular ve puan kartı. Hepsini sonra değiştirebilirsin." / "Ready stages, questions and scorecard for this role. You can change all of it later.", badge `recommended` "Önerilen" / "Recommended"). Read `ChoiceCardGroup` (`src/components/visual/choice-card.tsx`) for how a label can carry a badge; if it has no badge slot, render the badge inside `label` as a small `rounded-full bg-accent-soft text-accent text-[12px] px-2` span (no new prop on the shared block).
- When TEMPLATE is chosen, the start step's primary is "Devam et" to `#template`; the create button lives on the template step. Other starts keep "Alımı oluştur" on the start step.
- Template step (mockup 4b): title `stepTemplateTitle` "Hangi şablon?" / "Which template?", lead `stepTemplateLead` "Pozisyonuna en yakın olanı seç. Oluşturduktan sonra her soruyu değiştirebilirsin." / "Pick the one closest to your position. You can change every question after creating it." Three groups with headings (`groupGeneric` "Genel roller", `groupLanguageSchool` "Dil okulu", `groupExtra` "Diğer roller"); each card shows `positionIcon(name)` tile, name, summary, a meta line `templateMeta` "{stages} aşama · {questions} soru · {minutes} dk", up to 3 competency chips, and an outlined "Önizle" button (`preview`) that opens a Sheet (`src/components/ui/sheet.tsx`, the invite uses it) listing each stage's name and its candidate prompts. Card selection uses `ChoiceCardGroup` `look="panel"` single select. If `matchTemplate(position name)` finds one, it is preselected.
- The summary pill adds "{name} şablonu" (`summaryTemplate`) once a template is chosen.
- `page.tsx` passes `templates={templateCards(locale)}` (read how the page gets its locale today; use the same helper).

- [ ] **Step 1: Failing tests**: `start-choices.test.ts` (TEMPLATE first, then COPY when sources, AI, BLANK); `new-opening-steps.test.ts` (steps with template; `createWait` needTemplate; refusal map; summary part); `template-gallery.test.ts` with `renderToStaticMarkup` (three group headings, meta line text, at most 3 chips, the preselected card checked, "Önizle" button present, no `Sparkles` class `lucide-sparkles` anywhere).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the data, steps, gallery and form wiring; add every copy key to both message files.
- [ ] **Step 4: Run the tests plus `src/i18n` tests, expect PASS.**
- [ ] **Step 5: tsc, eslint, commit** (exact paths).

---

### Task 9: DB check on a throw-away database

**Files:**
- Create: `scripts/verify-hiring-templates.ts`; Modify: `package.json` (`"verify:hiring-templates": "tsx scripts/verify-hiring-templates.ts"`)

Read `scripts/verify-hiring-setup.ts` and `scripts/hiring-fixture.ts` first and follow them (the `_check` guard `refuseUnlessThrowAwayDb` from `src/db/working-db-guard.ts`, the ok/bad/check helpers, one org + users).

The script:
1. Creates a fresh organisation with no library (no `seedLibrary`), an active manager, and one position "Satış Temsilcisi" with no ad and no profile.
2. For every template in `TEMPLATES`: `createOpening` with a new position named after the template, `start: "TEMPLATE"`; then `loadVersionContent` + `loadCompetencyFacts` and `publishProblems` must be `[]`; stage and question counts equal the template's; `weightsEnabled` true and weights sum to 100.
3. Library after all 20: one competency row per distinct key (no duplicates; count equals `new Set(TEMPLATES.flatMap(templateCompetencyKeys)).size`), each with anchors 1/3/5.
4. The existing "Satış Temsilcisi" position: create with `sales-representative`; the position now has the template job ad and 3 profile rows. Run it again: the ad and profile are unchanged (no second fill).
5. Archive one template competency, create another opening that uses it: the row is active again.
6. `publishDraft` on one template opening succeeds.
7. Exit code 1 on any FAIL.

- [ ] **Step 1: Write the script.**
- [ ] **Step 2: Create the throw-away DB and run it**: `createdb -h localhost -p 5434 -U kademe kademe_templates_check`, `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_templates_check pnpm db:migrate`, then `DATABASE_URL=... pnpm verify:hiring-templates`. Expected: every line `ok`, exit 0. (If the cloud has no Postgres, write "not run: no Postgres" in the ledger and leave it for the local session.)
- [ ] **Step 3: tsc, eslint, commit.**

---

### Task 10: Whole gates and hand-off docs

- [ ] **Step 1**: `pnpm exec tsc --noEmit`, `pnpm exec eslint src scripts`, `pnpm test`, `pnpm build`. Record counts in the ledger.
- [ ] **Step 2**: em-dash scan over every file changed since the plan's base commit: `git diff --name-only <base>..HEAD | xargs grep -l "$(printf '\xe2\x80\x94')"` (expect no output) and the same over commit messages.
- [ ] **Step 3**: `docs/STATUS.md`: a templates row (what is built, test counts, what is not verified: HR expert review, German teacher trainer review of the proficiency stage, real candidate timings, the Chrome walk-through if not done); mark `docs/superpowers/NEXT-templates.md` as done with a pointer to this plan.
- [ ] **Step 4**: commit and push `platform/solutions`.

Controller after Task 10 (local session, not a subagent): whole-plan review on the most capable model, one fix wave, then the Chrome check: one opening from each group reaches "Yayınla" with only advisory rows, then the candidate flow once.
