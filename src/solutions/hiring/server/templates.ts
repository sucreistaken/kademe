import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { ensureDefaultScale } from "@/db/library-seed";
import { competencies, competencyAnchors, observationTags } from "@/db/schema";
import type { Locale } from "@/i18n/locale";
import { audit } from "@/server/library-write";
import { templateCompetency } from "../templates/competencies";
import { TEMPLATES } from "../templates/index";
import { templateMinutes, templateQuestionCount } from "../templates/materialise";
import type { TemplateGroup } from "../templates/types";

/** Recorded on the audit rows this file writes, so the library can tell where a row came from. */
const VIA = { via: "hiring.template" };
const LEVELS = [1, 3, 5] as const;
const nameKey = (name: string) => name.trim().toLocaleLowerCase("tr");

/**
 * The organisation's competency for each template key (spec
 * 2026-10-06-hiring-ready-templates-design, section 4.1), on the caller's
 * executor so it shares the opening's transaction. Per key, in order: the row
 * with that seed key (restored and audited when archived, because the manager
 * chose a template that measures it); else an active row whose TR or EN name
 * matches (the findOrCreateCompetency rule), so a team's own "İletişim" is
 * reused; else a new unreviewed row with the seed key, anchors 1/3/5 and
 * observation tags. A reused row gets the template's anchor only for a level
 * among 1, 3, 5 it lacks.
 */
export async function ensureTemplateCompetencies(x: Executor, orgId: string, actorId: string, keys: string[]): Promise<Record<string, string>> {
  const seeds = keys.map((key) => {
    const seed = templateCompetency(key);
    if (!seed) throw new Error(`unknown template competency ${key}`);
    return seed;
  });
  if (seeds.length === 0) return {};
  const seeded = await x
    .select({ id: competencies.id, seedKey: competencies.seedKey, archivedAt: competencies.archivedAt })
    .from(competencies)
    .where(and(eq(competencies.orgId, orgId), inArray(competencies.seedKey, keys)));
  let active: Array<{ id: string; name: { tr: string; en: string } }> | null = null;
  let scaleId: string | null = null;
  const ids: Record<string, string> = {};
  const reused: Array<{ id: string; key: string }> = [];

  for (const seed of seeds) {
    const own = seeded.find((r) => r.seedKey === seed.key);
    if (own) {
      if (own.archivedAt) {
        await x
          .update(competencies)
          .set({ archivedAt: null, updatedAt: new Date() })
          .where(and(eq(competencies.id, own.id), eq(competencies.orgId, orgId)));
        await audit(x, orgId, actorId, "library.competency.restore", "competency", own.id, VIA);
      }
      ids[seed.key] = own.id;
      reused.push({ id: own.id, key: seed.key });
      continue;
    }
    active ??= await x
      .select({ id: competencies.id, name: competencies.name })
      .from(competencies)
      .where(and(eq(competencies.orgId, orgId), isNull(competencies.archivedAt)));
    const wanted = [seed.name.tr, seed.name.en].map(nameKey).filter(Boolean);
    const named = active.find((r) => [r.name.tr, r.name.en].some((n) => wanted.includes(nameKey(n))));
    if (named) {
      ids[seed.key] = named.id;
      reused.push({ id: named.id, key: seed.key });
      continue;
    }
    scaleId ??= (await ensureDefaultScale(orgId, x)).id;
    const [row] = await x
      .insert(competencies)
      .values({ orgId, name: seed.name, description: seed.description, scaleId, seedKey: seed.key, reviewedAt: null })
      .returning({ id: competencies.id });
    await x.insert(competencyAnchors).values(LEVELS.map((value) => ({ competencyId: row.id, value, body: seed.anchors[value] })));
    const tags = [
      ...seed.positive.map((label) => ({ polarity: "POSITIVE" as const, label })),
      ...seed.negative.map((label) => ({ polarity: "NEGATIVE" as const, label })),
    ];
    if (tags.length) await x.insert(observationTags).values(tags.map((tag, i) => ({ competencyId: row.id, ...tag, orderIndex: i })));
    await audit(x, orgId, actorId, "library.competency.create", "competency", row.id, VIA);
    ids[seed.key] = row.id;
  }

  if (reused.length) {
    // The rows were just proven to be the organisation's, so their anchors are read by competency id.
    const present = await x
      .select({ competencyId: competencyAnchors.competencyId, value: competencyAnchors.value })
      .from(competencyAnchors)
      .where(inArray(competencyAnchors.competencyId, [...new Set(reused.map((r) => r.id))]));
    const missing = reused.flatMap(({ id, key }) =>
      LEVELS.filter((value) => !present.some((a) => a.competencyId === id && a.value === value)).map((value) => ({
        competencyId: id,
        value,
        body: templateCompetency(key)!.anchors[value],
      })),
    );
    // Unique on (competency_id, value): an anchor written meanwhile wins over the template's.
    if (missing.length) await x.insert(competencyAnchors).values(missing).onConflictDoNothing();
  }
  return ids;
}

export type TemplateCard = {
  key: string;
  group: TemplateGroup;
  name: string;
  summary: string;
  stageCount: number;
  questionCount: number;
  minutes: number;
  /** Competency names, highest weight first. */
  competencies: string[];
  /** The candidate-facing prompts per stage, for the read-only preview. */
  stages: Array<{ name: string; prompts: string[] }>;
};

/** The gallery (spec section 5) in one language, in TEMPLATES order. Pure: no database. */
export function templateCards(locale: Locale): TemplateCard[] {
  return TEMPLATES.map((template) => ({
    key: template.key,
    group: template.group,
    name: template.name[locale],
    summary: template.summary[locale],
    stageCount: template.stages.length,
    questionCount: templateQuestionCount(template),
    minutes: templateMinutes(template),
    competencies: Object.entries(template.weights)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => templateCompetency(key)?.name[locale] ?? key),
    stages: template.stages.map((stage) => ({ name: stage.name[locale], prompts: stage.activities.map((a) => a.prompt[locale]) })),
  }));
}
