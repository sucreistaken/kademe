import { pgEnum } from "drizzle-orm/pg-core";
import { PROCTOR_EVENT_TYPES } from "../../lib/proctor/taxonomy";
import { CEFR_LEVELS, EXAM_MODES, ITEM_TYPES, SECTIONS } from "../../lib/exam/types";

/**
 * Every fixed status list in the product, in one place. Adding a value is a
 * product decision, not a refactor.
 */

export const userRole = pgEnum("user_role", [
  "OWNER", // everything, including deletion, export and settings
  "TEACHER", // build exams, run the bank, invite, grade, finalize
  "REVIEWER", // grade and look at evidence only
]);

export const examMode = pgEnum("exam_mode", EXAM_MODES);
export const section = pgEnum("section", SECTIONS);
export const cefrLevel = pgEnum("cefr_level", CEFR_LEVELS);
export const itemType = pgEnum("item_type", ITEM_TYPES);

export const itemStatus = pgEnum("item_status", [
  "DRAFT", // written or generated, not yet approved; never served
  "APPROVED",
  "REJECTED",
  "RETIRED", // was live, taken out of rotation; kept for old reports
]);

export const itemOrigin = pgEnum("item_origin", ["SEED", "TEACHER", "AI"]);

export const blueprintStatus = pgEnum("blueprint_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);

/**
 * Which solution an invitation belongs to. A new solution adds one value here
 * and nothing else in the core schema.
 */
export const solution = pgEnum("solution", ["LANGUAGE_EXAM", "HIRING"]);

/**
 * RETAKE_AVAILABLE belongs to hiring: a retake reuses the same link and opens
 * a new attempt. The language exam never produces it.
 */
export const linkStatus = pgEnum("link_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "EXPIRED", "RETAKE_AVAILABLE"]);

export const runCompletion = pgEnum("run_completion", [
  "PENDING",
  "COMPLETE",
  "PARTIAL", // submitted with unanswered items
  "SKIPPED",
  "EXPIRED", // closed by the clock
]);

export const mediaStatus = pgEnum("media_status", [
  "UPLOADING",
  "READY",
  "INCOMPLETE", // browser died mid-recording, the parts we have are playable
  "FAILED",
]);

export const gradingStatus = pgEnum("grading_status", [
  "PENDING", // waiting for the answer to be ready or for the AI
  "AI_PROPOSED", // the AI suggested a level; a teacher has not looked yet
  "AI_FAILED", // no proposal; the teacher grades from scratch
  "CONFIRMED", // the teacher accepted the AI proposal
  "OVERRIDDEN", // the teacher set a different level, with a reason
]);

export const decider = pgEnum("decider", ["ENGINE", "AI", "TEACHER"]);

export const resultStatus = pgEnum("result_status", [
  "IN_PROGRESS",
  "AWAITING_GRADING",
  "AWAITING_REVIEW",
  "FINAL",
]);

export const verificationOutcome = pgEnum("verification_outcome", ["PASS", "FAIL", "INCONCLUSIVE"]);

export const integrityOutcome = pgEnum("integrity_outcome", ["VALID", "RETAKE", "INVALID"]);

/**
 * What the AI is used for. Placing a student and grading their writing and
 * speaking are high-risk uses under the EU AI Act (Annex III, education), so
 * every one of these is a proposal a teacher confirms or changes, and every
 * call lands in `ai_runs`. Inferring emotion, personality or identity is a
 * prohibited practice in education and has no purpose here.
 */
export const aiPurpose = pgEnum("ai_purpose", [
  "ITEM_GENERATION", // draft questions; a teacher approves each before use
  "TTS", // listening audio from a script
  "TRANSCRIPTION", // speech to text for speaking answers
  "WRITING_GRADING", // proposed CEFR level with quoted evidence
  "SPEAKING_GRADING", // same, from the transcript
  "PROCTOR_REVIEW", // observable facts in proctoring frames, never intent
]);

export const proctorEventType = pgEnum("proctor_event_type", PROCTOR_EVENT_TYPES);
export const proctorSeverity = pgEnum("proctor_severity", ["INFO", "LOW", "MEDIUM", "HIGH"]);
export const proctorSource = pgEnum("proctor_source", ["BROWSER", "MODEL", "SERVER"]);
export const evidenceKind = pgEnum("evidence_kind", ["WEBCAM_FRAME", "SCREEN_FRAME", "CLIP_VIDEO", "CLIP_AUDIO"]);
export const evidenceTrigger = pgEnum("evidence_trigger", ["REFERENCE", "PERIODIC", "VIOLATION"]);
export const aiReviewStatus = pgEnum("ai_review_status", ["QUEUED", "DONE", "FAILED", "SKIPPED"]);
export const aiVerdict = pgEnum("ai_verdict", ["CONFIRMED", "NOT_CONFIRMED", "UNCLEAR"]);
export const teacherFlagStatus = pgEnum("teacher_flag_status", ["OPEN", "CONFIRMED", "DISMISSED"]);

export const locale = pgEnum("locale", ["tr", "en"]);
