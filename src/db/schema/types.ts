/** Shared jsonb payload shapes. Kept next to the schema so both sides agree. */

/**
 * Interface copy stored in both languages (consent text). Exam content itself
 * is German and is not translated.
 */
export type I18nText = {
  tr: string;
  en: string;
};

export const emptyI18n = (): I18nText => ({ tr: "", en: "" });

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
