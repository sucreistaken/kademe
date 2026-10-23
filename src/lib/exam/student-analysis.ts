import { buildDetail, topicUnits, type DetailResponse } from "@/components/panel/report/detail-model";
import { isFormatTopic, topicLabel, type TopicId } from "@/lib/exam/topics";
import { isObjectiveSection, type Section } from "@/lib/exam/types";
import type { CandidateLocale } from "@/i18n/locale";

/**
 * What the student is given after release instead of the questions: how each
 * section went in counts, which topics were missed and which went well. Pure.
 * It counts answer units (a gap, a statement, a row, a choice) with the same
 * rules as the teacher's detailed report, so the two always agree, and it
 * never carries a prompt, an option, an answer or a key: only counts and
 * topic labels leave this module. Writing and speaking are decided by the
 * teacher and have no counts.
 */

export type AnalysisSection = { section: Section; right: number; wrong: number; blank: number; teacherAssessed?: true };
export type AnalysisTopic = { topic: TopicId; label: string; missed: number; asked: number };
export type StrongTopic = { topic: TopicId; label: string; asked: number };
export type StudentAnalysis = { sections: AnalysisSection[]; missedTopics: AnalysisTopic[]; strongTopics: StrongTopic[] };

export type AnalysisSource = {
  /** The ordered sections the exam had. */
  sections: string[];
  runs: Array<{ id: string; section: string; navigable: boolean }>;
  responses: DetailResponse[];
  /** Teacher acceptances by response id (`gapIds` empty: the whole short answer). */
  acceptances: Record<string, { gapIds: string[] }>;
};

/** A topic needs at least this many units, all right, to count as going well. */
const STRONG_MIN_ASKED = 2;

export function buildStudentAnalysis(src: AnalysisSource, locale: CandidateLocale): StudentAnalysis {
  const detail = buildDetail({
    sections: src.sections.filter((s) => isObjectiveSection(s as Section)),
    skillLevels: {},
    runs: src.runs,
    responses: src.responses,
    gradings: [],
    acceptances: src.acceptances,
    transcripts: {},
    nameOf: {},
  });
  const bySection = new Map(detail.map((d) => [d.section, d]));
  const tallies = new Map<TopicId, { missed: number; asked: number }>();
  const sections: AnalysisSection[] = [];
  for (const name of src.sections) {
    const section = name as Section;
    if (!isObjectiveSection(section)) {
      if (src.runs.some((r) => r.section === name)) sections.push({ section, right: 0, wrong: 0, blank: 0, teacherAssessed: true });
      continue;
    }
    const d = bySection.get(section);
    if (!d || d.kind !== "OBJECTIVE") continue;
    const row: AnalysisSection = { section, right: 0, wrong: 0, blank: 0 };
    for (const b of d.blocks) {
      for (const q of b.questions) {
        for (const u of topicUnits(q)) {
          const ok = u.mark === "correct" || u.mark === "accepted";
          if (ok) row.right += 1;
          else if (u.mark === "blank") row.blank += 1;
          else row.wrong += 1;
          if (isFormatTopic(u.topic)) continue;
          const t = tallies.get(u.topic) ?? { missed: 0, asked: 0 };
          t.asked += 1;
          if (!ok) t.missed += 1;
          tallies.set(u.topic, t);
        }
      }
    }
    sections.push(row);
  }
  const missedTopics: AnalysisTopic[] = [];
  const strongTopics: StrongTopic[] = [];
  for (const [topic, t] of tallies) {
    const label = topicLabel(topic, locale);
    if (!label) continue;
    if (t.missed > 0) missedTopics.push({ topic, label, missed: t.missed, asked: t.asked });
    else if (t.asked >= STRONG_MIN_ASKED) strongTopics.push({ topic, label, asked: t.asked });
  }
  missedTopics.sort((a, b) => b.missed - a.missed || a.label.localeCompare(b.label, locale));
  strongTopics.sort((a, b) => b.asked - a.asked || a.label.localeCompare(b.label, locale));
  return { sections, missedTopics, strongTopics };
}
