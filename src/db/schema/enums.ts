import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Every fixed status list in the product. These come straight from the product
 * brief and the design canvas; adding a value is a product decision, not a
 * refactor, so they live in one place.
 */

export const userRole = pgEnum("user_role", [
  "OWNER", // everything, including deletion and export
  "RECRUITER", // create, invite, evaluate
  "REVIEWER", // evaluate only. Cannot delete or export.
]);

export const versionStatus = pgEnum("version_status", [
  "DRAFT",
  "PUBLISHED", // immutable from here on, enforced by a DB trigger
  "ARCHIVED",
]);

export const activityType = pgEnum("activity_type", [
  "VIDEO",
  "AUDIO",
  "LONG_TEXT",
  "SHORT_TEXT",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "FILE_UPLOAD",
  "SCENARIO",
]);

/** What happens when a stage runs out of time. */
export const timeoutBehaviour = pgEnum("timeout_behaviour", [
  "AUTO_SUBMIT", // default: whatever exists is submitted
  "AUTO_CLOSE", // stage closes, nothing further accepted
  "ALLOW_GRACE", // grace period starts
  "ALLOW_LATE", // candidate may finish, the run is flagged late
]);

export const linkStatus = pgEnum("link_status", [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "EXPIRED",
  "RETAKE_REQUESTED",
  "RETAKE_AVAILABLE",
]);

export const decisionStatus = pgEnum("decision_status", [
  "NEW",
  "IN_REVIEW",
  "SHORTLISTED",
  "INTERVIEW",
  "RETAKE_REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "ON_HOLD",
]);

export const attemptScope = pgEnum("attempt_scope", [
  "FULL",
  "PARTIAL", // only the stages the manager asked to be redone
]);

export const runCompletion = pgEnum("run_completion", [
  "PENDING",
  "COMPLETE",
  "PARTIAL", // candidate answered some of it
  "SKIPPED",
  "EXPIRED",
]);

export const mediaStatus = pgEnum("media_status", [
  "UPLOADING",
  "READY",
  "INCOMPLETE", // browser died mid-recording, the parts we have are playable
  "FAILED",
]);

export const optionPolarity = pgEnum("option_polarity", [
  "POSITIVE",
  "NEGATIVE",
]);

/**
 * Only three AI purposes exist, and none of them score or rank a candidate.
 * Inferring emotion or personality from video or voice is a prohibited practice
 * under the EU AI Act, so there is deliberately no enum value for it.
 */
export const aiPurpose = pgEnum("ai_purpose", [
  "TEMPLATE_DRAFT", // job description -> suggested assessment, manager approves each item
  "TRANSCRIPTION", // speech to text
  "EVALUATION_SUMMARY", // summarises the manager's OWN scores and notes, nothing else
]);

/** Technical events we can actually observe in a browser. Nothing aspirational. */
export const technicalEventType = pgEnum("technical_event_type", [
  "VISIBILITY_HIDDEN",
  "VISIBILITY_VISIBLE",
  "WINDOW_BLUR",
  "WINDOW_FOCUS",
  "FULLSCREEN_ENTER",
  "FULLSCREEN_EXIT",
  "CAMERA_MUTED",
  "CAMERA_UNMUTED",
  "MIC_MUTED",
  "MIC_UNMUTED",
  "OFFLINE",
  "ONLINE",
  "PAGE_UNLOAD",
  "UPLOAD_STALLED",
  "UPLOAD_RESUMED",
  "DEVICE_CHECK_FAILED",
]);

export const locale = pgEnum("locale", ["tr", "en"]);
