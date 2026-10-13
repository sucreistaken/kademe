"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { BookOpen, CircleCheck, Download, FileUp, Headphones, SpellCheck, TriangleAlert } from "lucide-react";
import { importBankFileAction } from "@/app/(manager)/exam/bank/actions";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { flowJourney } from "@/components/manager/flow-model";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { Disclosure } from "@/components/visual/disclosure";
import { useMT } from "@/i18n/manager-client";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import {
  IMPORT_SECTIONS,
  MAX_IMPORT_ROWS,
  OPTION_COLUMNS,
  parseLevel,
  parseType,
  planImport,
  readSheet,
  rowCellSettings,
  templateCsv,
  type ImportSection,
  type ImportSettings,
  type SheetCode,
  type SheetColumn,
  type SheetRow,
} from "@/lib/exam/bank-sheet";
import { parseWithin, WITHINS, type Within } from "@/lib/exam/difficulty";
import { CEFR_LEVELS, type Cefr } from "@/lib/exam/types";
import { issueText } from "./bank-copy";

type Step = "file" | "check" | "settings" | "done";
const STEPS: readonly Step[] = ["file", "check", "settings", "done"];
const PATH: readonly Step[] = ["file", "check", "settings"];

/** A server action body is capped at 1 MB; the file stays well under it. */
export const MAX_FILE_BYTES = 700 * 1024;

const SECTION_ICON = { GRAMMAR: SpellCheck, READING: BookOpen, LISTENING: Headphones } as const;
const LINK =
  "inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-ink underline decoration-underline underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink";
const SMALL = "inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] font-medium text-ink hover:bg-canvas";
const SELECT = "h-10 rounded-lg border border-input bg-surface px-2 text-[13.5px] text-ink";

type Source = { kind: "file"; name: string; text: string } | { kind: "paste"; text: string } | null;

/** Reads a file as UTF-8, or as Windows-1254 (Turkish Excel's "CSV") when it is not valid UTF-8. */
async function readText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1254").decode(bytes);
  }
}

const looksLikeExcel = (name: string, head: string) => /\.xlsx?$/i.test(name) || head.startsWith("PK\u0003\u0004");

/** The columns of the fix form for a row: what the file has, plus the type's essentials. */
function fixColumns(row: SheetRow, fileColumns: Set<SheetColumn>): SheetColumn[] {
  const type = parseType(row.cells.type ?? "");
  const out: SheetColumn[] = ["type", "question"];
  const options = OPTION_COLUMNS.filter((c) => fileColumns.has(c) || row.cells[c]);
  const wantOptions = type !== "SHORT_TEXT";
  if (wantOptions) out.push(...(options.length ? options : OPTION_COLUMNS.slice(0, 4)));
  if (type !== "MATCHING") out.push("answer");
  for (const c of ["section", "level", "difficulty", "text_title", "text"] as const) if (fileColumns.has(c) || row.cells[c]) out.push(c);
  return out;
}

/**
 * "Dosyadan yükle" as a guided flow (the hiring setup wizard's pattern):
 * 1 "Dosya yükle": a CSV / TSV file or a paste, with the example file one
 * click away. 2 "Kontrol": every row with its problems in the teacher's
 * words, fixable in place. 3 "Seviye ve zorluk": section, level and Kolay /
 * Orta / Zor for the whole file, changeable per row. Then the rows are added
 * as drafts and the last screen says "n eklendi, m hatalı".
 */
export function BankUploadWizard({ locale }: { locale: Locale }) {
  const t = useMT("bankTools");
  const sec = useMT("sectionName");
  const bank = useMT("bank");
  const flow = useMT("flow");
  const bt = (k: string, v?: Record<string, string | number>) => t(k as never, v);
  const fileInput = useRef<HTMLInputElement>(null);
  const uid = useId();

  const [source, setSource] = useState<Source>(null);
  const [paste, setPaste] = useState("");
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [defaults, setDefaults] = useState<ImportSettings>({ section: "GRAMMAR", level: "B1", within: "MID" });
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [result, setResult] = useState<{ created: number; failedLines: number[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, startImport] = useTransition();

  const plan = useMemo(() => (rows ? planImport(rows, defaults) : null), [rows, defaults]);
  const valid = plan?.items.length ?? 0;
  const bad = plan ? plan.rows.filter((r) => r.issues.length).length : 0;
  const fileColumns = useMemo(() => new Set(rows?.flatMap((r) => Object.keys(r.cells) as SheetColumn[]) ?? []), [rows]);

  const firstInvalid: Step | null = !rows ? "file" : valid === 0 ? "check" : !result ? "settings" : null;
  const nav = useFlowStep({ steps: STEPS, firstInvalid, mode: "hash" });
  const step = nav.step;

  const text = source?.text ?? "";

  async function onFile(file: File | undefined) {
    setSheetError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setSheetError(t("fileTooBig"));
      return;
    }
    try {
      const content = await readText(file);
      if (looksLikeExcel(file.name, content.slice(0, 4))) {
        setSheetError(t("fileExcel"));
        return;
      }
      setSource({ kind: "file", name: file.name, text: content });
      setPaste("");
    } catch {
      setSheetError(t("fileUnreadable"));
    }
  }

  function readSource() {
    setSheetError(null);
    const sheet = readSheet(text);
    if (!sheet.ok) {
      setSheetError(t(`sheet${sheet.code as SheetCode}`, sheet.code === "TOO_MANY_ROWS" ? { max: MAX_IMPORT_ROWS } : undefined));
      return;
    }
    setIgnored(sheet.ignoredColumns);
    setRows(sheet.rows);
    setResult(null);
    const hasText = sheet.rows.some((r) => r.cells.text?.trim());
    setDefaults((d) => ({ ...d, section: hasText && d.section === "GRAMMAR" ? "READING" : d.section }));
    setOnlyProblems(true);
    nav.go("check");
  }

  function downloadTemplate() {
    const tpl = templateCsv(locale);
    const url = URL.createObjectURL(new Blob([tpl.text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = tpl.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setCell(line: number, column: SheetColumn, value: string) {
    setRows((rs) => rs?.map((r) => (r.line === line ? { ...r, cells: { ...r.cells, [column]: value } } : r)) ?? null);
  }
  function clearColumn(column: "section" | "level" | "difficulty") {
    setRows((rs) => rs?.map((r) => ({ ...r, cells: { ...r.cells, [column]: undefined } })) ?? null);
  }

  function runImport() {
    if (!rows) return;
    setImportError(null);
    startImport(async () => {
      try {
        const res = await importBankFileAction({ rows, defaults, overrides: {} });
        if (!res.ok) {
          setImportError(t("importFailed", { reason: res.code }));
          return;
        }
        setResult({ created: res.created, failedLines: res.failedLines });
        nav.go("done");
      } catch {
        setImportError(t("importFailed", { reason: "network" }));
      }
    });
  }

  function restart() {
    setSource(null);
    setPaste("");
    setRows(null);
    setResult(null);
    setSheetError(null);
    setImportError(null);
    nav.go("file");
  }

  // ---------------------------------------------------------------- step 1
  const fileStep: FlowStep = {
    id: "file",
    title: t("fileTitle"),
    lead: <p>{t("fileLead")}</p>,
    layout: "single",
    primary: { kind: "button", id: "upload-to-check", label: flow("continue"), waitReason: text.trim() ? null : t("needFile"), onClick: readSource },
    note: sheetError ? (
      <p role="alert" className="text-[14px] font-medium text-ink">
        {sheetError}
      </p>
    ) : null,
    body: (
      <div className="space-y-6">
        <div className="rounded-xl border-[1.5px] border-dashed border-line bg-surface p-5">
          <input
            ref={fileInput}
            id={`${uid}-file`}
            type="file"
            aria-label={t("fileInput")}
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={cn(SMALL, "min-h-11 px-4 text-[15px]")} onClick={() => fileInput.current?.click()}>
              <FileUp className="size-5" aria-hidden />
              {t("chooseFile")}
            </button>
            <span className="text-[13px] text-muted">{t("fileTypes")}</span>
          </div>
          {source?.kind === "file" ? (
            <p role="status" className="mt-3 flex items-center gap-2 text-[14px] font-medium text-ink">
              <CircleCheck className="size-4 text-accent" aria-hidden />
              {t("fileRead", { name: source.name })}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor={`${uid}-paste`} className="mb-1.5 block text-[14px] font-semibold text-ink">
            {t("orPaste")}
          </label>
          <Textarea
            id={`${uid}-paste`}
            value={paste}
            rows={5}
            placeholder={t("pastePlaceholder")}
            onChange={(e) => {
              setPaste(e.target.value);
              setSource(e.target.value.trim() ? { kind: "paste", text: e.target.value } : null);
            }}
            className="bg-surface font-mono text-[13px]"
          />
        </div>
        <div className="space-y-1 rounded-xl border border-line bg-canvas p-4">
          <button type="button" className={LINK} onClick={downloadTemplate}>
            <Download className="size-4" aria-hidden />
            {t("template")}
          </button>
          <p className="text-[13.5px] text-ink-2">{t("templateHint")}</p>
          <Disclosure label={<span className="text-[14px]">{t("columnsHelp")}</span>} variant="inline">
            <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] leading-[21px] text-ink-2">
              {(["colType", "colSettings", "colText", "colQuestion", "colOptions", "colAnswer"] as const).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
          </Disclosure>
        </div>
      </div>
    ),
  };

  // ---------------------------------------------------------------- step 2
  const shown = plan ? plan.rows.filter((r) => !onlyProblems || bad === 0 || r.issues.length > 0) : [];
  const checkStep: FlowStep = {
    id: "check",
    title: t("checkTitle"),
    lead: <p>{bad ? t("checkLead", { ok: valid, bad }) : t("checkLeadAllOk", { ok: valid })}</p>,
    layout: "single",
    primary: { kind: "button", id: "upload-to-settings", label: flow("continue"), waitReason: valid === 0 ? t("noValid") : null, onClick: () => nav.go("settings") },
    note: bad > 0 && valid > 0 ? <p className="text-[13.5px] text-muted">{t("skipNote")}</p> : null,
    body: (
      <div className="space-y-4">
        {ignored.length ? <p className="text-[13.5px] text-muted">{t("ignoredColumns", { names: ignored.join(", ") })}</p> : null}
        {bad > 0 ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-ink">
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
            {t("onlyProblems")}
          </label>
        ) : null}
        <ol className="space-y-3">
          {shown.map((r) => {
            const row = rows!.find((x) => x.line === r.line)!;
            const type = parseType(row.cells.type ?? "");
            const ok = r.issues.length === 0;
            return (
              <li key={r.line} className={cn("rounded-xl border bg-surface p-4", ok ? "border-line" : "border-ink-3")}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tnum text-[13px] font-semibold text-muted">{t("line", { line: r.line })}</span>
                  <span className="text-[13px] text-ink-2">{type ? bank(`type${type}`) : (row.cells.type ?? "")}</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    {ok ? <CircleCheck className="size-4 text-accent" aria-hidden /> : <TriangleAlert className="size-4 text-ink" aria-hidden />}
                    {ok ? t("ready") : null}
                  </span>
                </div>
                <p lang="de" className="mt-1 line-clamp-2 text-[14.5px] text-ink">
                  {row.cells.question ?? ""}
                </p>
                {!ok ? (
                  <>
                    <ul className="mt-2 space-y-1 text-[13.5px] font-medium text-ink">
                      {r.issues.map((issue, i) => (
                        <li key={i}>{issueText(bt, issue)}</li>
                      ))}
                    </ul>
                    <Disclosure label={<span className="text-[14px]">{t("fix")}</span>} variant="inline" className="mt-1">
                      <p className="mb-3 text-[13px] text-muted">{t("fixLead")}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {fixColumns(row, fileColumns).map((c) => {
                          const id = `${uid}-r${r.line}-${c}`;
                          const long = c === "text" || c === "question";
                          return (
                            <div key={c} className={long ? "sm:col-span-2" : undefined}>
                              <label htmlFor={id} className="mb-1 block text-[12.5px] font-medium text-muted">
                                {(OPTION_COLUMNS as readonly string[]).includes(c) ? c : t(`c_${c as Exclude<SheetColumn, (typeof OPTION_COLUMNS)[number]>}`)}
                              </label>
                              {long ? (
                                <Textarea id={id} value={row.cells[c] ?? ""} rows={c === "text" ? 4 : 2} lang="de" onChange={(e) => setCell(r.line, c, e.target.value)} className="bg-surface text-[14px]" />
                              ) : (
                                <Input id={id} value={row.cells[c] ?? ""} lang="de" onChange={(e) => setCell(r.line, c, e.target.value)} className="h-10 bg-surface text-[14px]" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Disclosure>
                  </>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    ),
  };

  // ---------------------------------------------------------------- step 3
  const own = (column: "section" | "level" | "difficulty") => (rows ?? []).filter((r) => r.cells[column]?.trim()).length;
  const ownNote = (column: "section" | "level" | "difficulty") => {
    const n = own(column);
    return n ? (
      <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[13.5px] text-ink-2">
        {t("ownValues", { n })}
        <button type="button" className={LINK} onClick={() => clearColumn(column)}>
          {t("applyAll")}
        </button>
      </p>
    ) : null;
  };
  const settingsStep: FlowStep = {
    id: "settings",
    title: t("settingsTitle"),
    lead: (
      <p>
        {t("settingsLead")} {t("withinNote")}
      </p>
    ),
    layout: "single",
    primary: {
      kind: "button",
      id: "upload-import",
      label: t("import", { n: valid }),
      busy: importing,
      busyLabel: t("importing"),
      waitReason: result ? t("alreadyAdded") : valid === 0 ? t("noValid") : null,
      onClick: runImport,
    },
    note: importError ? (
      <p role="alert" className="text-[14px] font-medium text-ink">
        {importError}
      </p>
    ) : null,
    body: (
      <div className="space-y-8">
        <div>
          <p id={`${uid}-sec`} className="mb-3 text-[15px] font-semibold text-ink">
            {t("defaultSection")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="up-section"
            look="panel"
            columns={3}
            labelledBy={`${uid}-sec`}
            value={[defaults.section]}
            onChange={([v]) => setDefaults((d) => ({ ...d, section: v as ImportSection }))}
            items={IMPORT_SECTIONS.map((s) => ({ value: s, label: sec(s), marker: SECTION_ICON[s] }))}
          />
          {ownNote("section")}
        </div>
        <div>
          <p id={`${uid}-lvl`} className="mb-3 text-[15px] font-semibold text-ink">
            {t("defaultLevel")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="up-level"
            look="panel"
            columns={3}
            labelledBy={`${uid}-lvl`}
            value={[defaults.level]}
            onChange={([v]) => setDefaults((d) => ({ ...d, level: v as Cefr }))}
            items={CEFR_LEVELS.map((l) => ({ value: l, label: l }))}
          />
          {ownNote("level")}
        </div>
        <div>
          <p id={`${uid}-within`} className="mb-3 text-[15px] font-semibold text-ink">
            {t("defaultWithin")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="up-within"
            look="panel"
            columns={3}
            labelledBy={`${uid}-within`}
            value={[defaults.within]}
            onChange={([v]) => setDefaults((d) => ({ ...d, within: v as Within }))}
            items={WITHINS.map((w) => ({ value: w, label: t(`within${w}`), description: t(`withinHint${w}`) }))}
          />
          {ownNote("difficulty")}
        </div>
        <div className="rounded-xl border border-line bg-surface px-4">
          <Disclosure label={<span className="text-[15px]">{t("perRow")}</span>} variant="inline">
            <ol className="divide-y divide-line">
              {(plan?.rows ?? [])
                .filter((r) => r.issues.length === 0 || r.issues.every((i) => i.kind === "row" && ["SECTION_UNKNOWN", "SECTION_NOT_OBJECTIVE", "LEVEL_UNKNOWN", "DIFFICULTY_UNKNOWN", "TEXT_IN_GRAMMAR", "LISTENING_WITHOUT_TEXT", "TEXT_SECTION_MIXED"].includes(i.code)))
                .map((r) => {
                  const row = rows!.find((x) => x.line === r.line)!;
                  const cellValues = rowCellSettings(row).values;
                  const label = t("line", { line: r.line });
                  return (
                    <li key={r.line} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
                      <span className="min-w-0 text-[13.5px] text-ink">
                        <span className="tnum font-semibold text-muted">{label}</span>{" "}
                        <span lang="de" className="line-clamp-1">
                          {row.cells.question ?? ""}
                        </span>
                        {r.issues.length ? <span className="block text-[12.5px] font-medium text-ink">{issueText(bt, r.issues[0])}</span> : null}
                      </span>
                      <select aria-label={`${label}: ${t("defaultSection")}`} className={SELECT} value={cellValues.section ?? ""} onChange={(e) => setCell(r.line, "section", e.target.value)}>
                        <option value="">{`${t("useDefault")} (${sec(defaults.section)})`}</option>
                        {IMPORT_SECTIONS.map((s) => (
                          <option key={s} value={s}>
                            {sec(s)}
                          </option>
                        ))}
                      </select>
                      <select aria-label={`${label}: ${t("defaultLevel")}`} className={SELECT} value={parseLevel(row.cells.level ?? "") ?? ""} onChange={(e) => setCell(r.line, "level", e.target.value)}>
                        <option value="">{`${t("useDefault")} (${defaults.level})`}</option>
                        {CEFR_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <select aria-label={`${label}: ${t("defaultWithin")}`} className={SELECT} value={parseWithin(row.cells.difficulty) ?? ""} onChange={(e) => setCell(r.line, "difficulty", e.target.value)}>
                        <option value="">{`${t("useDefault")} (${t(`within${defaults.within}`)})`}</option>
                        {WITHINS.map((w) => (
                          <option key={w} value={w}>
                            {t(`within${w}`)}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
            </ol>
          </Disclosure>
        </div>
      </div>
    ),
  };

  // ---------------------------------------------------------------- done
  const doneStep: FlowStep = {
    id: "done",
    title: t("doneTitle", { created: result?.created ?? 0, failed: result?.failedLines.length ?? 0 }),
    lead: <p>{t("doneLead")}</p>,
    layout: "single",
    primary: { kind: "link", id: "upload-open-pending", label: t("openPending"), href: "/exam/bank?tab=pending" },
    body: (
      <div className="space-y-4">
        {result?.failedLines.length ? <p className="tnum text-[14px] text-ink">{t("doneFailedLines", { lines: result.failedLines.join(", ") })}</p> : null}
        <button type="button" className={LINK} onClick={restart}>
          {t("another")}
        </button>
      </div>
    ),
  };

  const current = step === "file" ? fileStep : step === "check" ? checkStep : step === "settings" ? settingsStep : doneStep;
  return (
    <GuidedFlow
      kicker={t("uploadKicker")}
      step={current}
      journey={step === "done" ? null : flowJourney(PATH, step)}
      back={step === "file" || step === "done" ? null : { label: flow("back"), onClick: () => nav.back() }}
      exit={{ dirty: !!rows && !result, href: "/exam/bank" }}
      enter={nav.moved}
    />
  );
}
