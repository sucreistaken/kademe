import type { Locale } from "@/i18n/locale";
import { DEFAULT_MAX_FILE_BYTES } from "@/solutions/hiring/rules/candidate-flow";

/** The document types a manager can ask for (lib/candidate-media DOCUMENT_MIME), with their names and extensions. */
const TYPES: Record<string, { label: string; ext: string[] }> = {
  "application/pdf": { label: "PDF", ext: [".pdf"] },
  "application/msword": { label: "DOC", ext: [".doc"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { label: "DOCX", ext: [".docx"] },
  "application/vnd.ms-excel": { label: "XLS", ext: [".xls"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { label: "XLSX", ext: [".xlsx"] },
  "application/vnd.ms-powerpoint": { label: "PPT", ext: [".ppt"] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { label: "PPTX", ext: [".pptx"] },
  "application/zip": { label: "ZIP", ext: [".zip"] },
  "image/png": { label: "PNG", ext: [".png"] },
  "image/jpeg": { label: "JPG", ext: [".jpg", ".jpeg"] },
  "text/plain": { label: "TXT", ext: [".txt"] },
  "text/csv": { label: "CSV", ext: [".csv"] },
};

/** A type as the server compares it (lib/candidate-media normaliseFileMime): lower case, without parameters. */
const baseOf = (mime: string) => mime.split(";")[0].trim().toLowerCase();

/** "PDF" for application/pdf; an unknown type by its own short name. */
export const mimeLabel = (mime: string) => TYPES[mime]?.label ?? (mime.split("/")[1] ?? mime).toUpperCase();

/** "PDF, DOCX ya da PNG" in the candidate's language; null when any type is fine. */
export function typeList(accepted: string[] | null, locale: Locale): string | null {
  if (!accepted || accepted.length === 0) return null;
  return new Intl.ListFormat(locale === "tr" ? "tr-TR" : "en-GB", { type: "disjunction" }).format(accepted.map(mimeLabel));
}

export function megabytes(bytes: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

/** The size of the candidate's own file: "340 KB" under a megabyte (never "0"), "1,5 MB" above. */
export function sizeLabel(bytes: number, locale: Locale): string {
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB").format(Math.max(1, Math.ceil(bytes / 1024)))} KB`;
  return `${megabytes(bytes, locale)} MB`;
}

/** The type an extension names ("" for an unknown one). */
function extensionType(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = name.slice(dot).toLowerCase();
  return Object.entries(TYPES).find(([, t]) => t.ext.includes(ext))?.[0] ?? "";
}

/**
 * The type the upload declares: the browser's, or the one its extension names
 * when the browser leaves it empty (Windows for a .docx without Office) or
 * reports a type the question does not take while the extension's type is on
 * its list (fix round 1, I3: Windows Chrome says application/vnd.ms-excel for
 * a .csv and application/x-zip-compressed for a .zip). The server checks the
 * declared type against the list again.
 */
export function mimeOf(file: { type: string; name: string }, accepted: string[] | null = null): string {
  const own = file.type ? baseOf(file.type) : "";
  const byName = extensionType(file.name);
  if (!own) return byName;
  if (accepted && accepted.length > 0) {
    const list = accepted.map(baseOf);
    if (!list.includes(own) && byName && list.includes(byName)) return byName;
  }
  return own;
}

/** The file picker's filter: each accepted type and its extensions; nothing when any type is fine. */
export function acceptAttr(accepted: string[] | null): string | undefined {
  if (!accepted || accepted.length === 0) return undefined;
  return accepted.flatMap((mime) => [mime, ...(TYPES[mime]?.ext ?? [])]).join(",");
}

export type FileProblem = "type" | "size" | "empty";

/** Checked before the upload; the server checks the same again (and the stored size on completion). */
export function fileProblem(file: { type: string; size: number }, accepted: string[] | null, maxBytes: number | null): FileProblem | null {
  if (file.size <= 0) return "empty";
  if (accepted && accepted.length > 0 && !accepted.map(baseOf).includes(baseOf(file.type))) return "type";
  if (file.size > (maxBytes ?? DEFAULT_MAX_FILE_BYTES)) return "size";
  return null;
}
