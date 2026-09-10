/** Shared jsonb payload shapes. Kept next to the schema so both sides agree. */

/**
 * Every candidate-facing string is stored in both languages. The manager writes
 * one and may translate the other; an empty string means "fall back to the
 * template's default locale".
 */
export type I18nText = {
  tr: string;
  en: string;
};

export const emptyI18n = (): I18nText => ({ tr: "", en: "" });

/** Per-activity settings. Only the keys relevant to the activity type are set. */
export type ActivityConfig = {
  /** SINGLE_CHOICE / MULTI_CHOICE */
  choices?: Array<{
    id: string;
    label: I18nText;
    /** Auto-scored questions feed the separate Knowledge Score, never the
     *  competency average. */
    correct?: boolean;
  }>;
  /** LONG_TEXT / SHORT_TEXT */
  minChars?: number;
  maxChars?: number;
  /** FILE_UPLOAD */
  acceptedMimeTypes?: string[];
  maxFileBytes?: number;
  /** VIDEO / AUDIO: a written fallback the manager can enable so that a
   *  candidate who cannot record is not excluded. */
  textAlternativeEnabled?: boolean;
};

/** What the candidate actually submitted, shape depends on activity type. */
export type ResponsePayload = {
  text?: string;
  choiceIds?: string[];
  mediaAssetId?: string;
  fileAssetIds?: string[];
  /** Set when the candidate used the accessibility fallback instead of video. */
  usedTextAlternative?: boolean;
};

/** Word-level timestamps, so a click in the transcript seeks the video. */
export type TranscriptWord = {
  text: string;
  startMs: number;
  endMs: number;
};

/** One completed S3/R2 multipart part. */
export type UploadPart = {
  partNumber: number;
  etag: string;
  bytes: number;
};
