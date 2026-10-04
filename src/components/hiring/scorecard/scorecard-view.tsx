"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { I18nText } from "@/db/schema/types";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import { missingAnchorLevels } from "@/lib/library/anchors";
import { sameWeightSet, WEIGHT_REASON_MIN } from "@/solutions/hiring/rules/weights";
import type { MatrixColumn } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/data";
import { addWeightSetAction, saveDraftWeightsAction } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/actions";
import type { ScorecardCode } from "@/app/(manager)/hiring/openings/[id]/assessment/scorecard/result";
import { AnchorSheet } from "./anchor-sheet";
import { refusalText } from "./refusal-copy";
import { currentWeightSet, readWeights, type WeightSet, type WeightsFormProblem } from "./weights-form";

export type ScorecardRow = {
  id: string;
  name: string;
  /** Required levels without text; empty on a published card (the gate refused it otherwise). */
  missingLevels: number[];
  /** The question ids (columns) that measure this competency. */
  measuredBy: string[];
  anchors: Partial<Record<number, I18nText>>;
  /** archived: read-only in the library; unknown: not the organisation's any more (the gate names both). */
  state: "active" | "archived" | "unknown";
};

type Outcome = { kind: "saved" } | { kind: "refused"; code: ScorecardCode | "NETWORK"; total?: number } | null;

/**
 * HIRING-UX 5.7: "Neyi, hangi soruyla, ne kadar önemseyerek ölçüyoruz?" The
 * matrix of competencies by question with each row's anchor state, the
 * weights (collapsed, equal by default), the decision rule, and one filled
 * "Puan kartını kaydet" that states why it is off. On a draft it saves the
 * draft's weights; on a live version it adds a weight set with a reason. Both
 * send the version the form was loaded for, so a version published meanwhile
 * answers STALE. A live change must differ from the current set (NO_CHANGE).
 * While the anchor Sheet is open its own save is the one filled button
 * (ruling C21). Question columns carry a visible legend and a full name for
 * screen readers (review Important 2).
 */
export function ScorecardView({
  openingId,
  versionId,
  mode,
  liveNumber,
  baseline,
  rows,
  columns,
  choiceCount,
  initialEnabled,
  initialWeights,
  openWeights,
  initialSheet,
  levels,
  editReason,
  anchorsReason,
}: {
  openingId: string;
  versionId: string;
  mode: "draft" | "live";
  liveNumber: number | null;
  /** Live only: the current weight set (or the published card before any), which a change must differ from. */
  baseline: { enabled: boolean; weights: Record<string, number> } | null;
  rows: ScorecardRow[];
  columns: MatrixColumn[];
  choiceCount: number;
  initialEnabled: boolean;
  /** As typed: a measured competency without a weight starts empty. */
  initialWeights: Record<string, string>;
  openWeights: boolean;
  initialSheet: string | null;
  levels: Array<{ value: number; label: string }>;
  /** Null when this viewer may change the scorecard, else why not (closed, role). */
  editReason: string | null;
  /** Null when the anchors may be saved from here, else why not (role). */
  anchorsReason: string | null;
}) {
  const t = useMT("hiringScorecard");
  const router = useRouter();
  const canEdit = editReason === null;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [raw, setRaw] = useState(initialWeights);
  const [reason, setReason] = useState("");
  const [weightsOpen, setWeightsOpen] = useState(initialEnabled || openWeights);
  const [sheetId, setSheetId] = useState<string | null>(initialSheet && rows.some((r) => r.id === initialSheet) ? initialSheet : null);
  /** Anchors the Sheet saved, shown at once (the refreshed page brings the same). */
  const [adopted, setAdopted] = useState<Record<string, Partial<Record<number, I18nText>>>>({});
  const [anchorsSaved, setAnchorsSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>(null);
  /** The set this form just saved and the server set it replaced; see currentWeightSet. */
  const [savedSet, setSavedSet] = useState<{ set: WeightSet; over: WeightSet | null } | null>(null);

  const shown = rows.map((row) =>
    adopted[row.id] ? { ...row, anchors: adopted[row.id], missingLevels: missingAnchorLevels(adopted[row.id]) } : row,
  );
  const sheetRow = shown.find((r) => r.id === sheetId) ?? null;
  const used = rows.map((r) => r.id);
  const read = readWeights(raw, used);
  const nameOf = (id: string) => rows.find((r) => r.id === id)?.name ?? "";
  const problemText = (p: WeightsFormProblem) => {
    if (p.code === "NOT_100") return p.total < 100 ? t("missing", { total: p.total, gap: p.gap }) : t("over", { total: p.total, gap: p.gap });
    return t(p.code === "MISSING" ? "weightMissing" : "weightNotWhole", { competency: nameOf(p.competencyId) || t("unknownCompetency") });
  };
  const current = currentWeightSet(savedSet, baseline);
  const unchanged = mode === "live" && current !== null && sameWeightSet({ enabled, weights: read.weights }, current, used);
  const saveReason = !canEdit
    ? editReason
    : rows.length === 0
      ? t("noCompetencies")
      : enabled && read.problem
        ? problemText(read.problem)
        : unchanged
          ? t("errNoChange")
          : mode === "live" && reason.trim().length < WEIGHT_REASON_MIN
            ? t("reasonRequired")
            : null;
  const faultyId = enabled && read.problem && read.problem.code !== "NOT_100" ? read.problem.competencyId : null;

  function save() {
    setOutcome(null);
    const payload = { versionId, enabled, weights: read.weights };
    start(async () => {
      try {
        const res = mode === "draft" ? await saveDraftWeightsAction(openingId, payload) : await addWeightSetAction(openingId, { ...payload, reason });
        if (res.ok) {
          setOutcome({ kind: "saved" });
          if (mode === "live") setSavedSet({ set: { enabled, weights: read.weights }, over: baseline });
          setReason("");
          router.refresh();
        } else {
          setOutcome({ kind: "refused", code: res.code, total: res.total });
        }
      } catch {
        setOutcome({ kind: "refused", code: "NETWORK" });
      }
    });
  }

  const sheetEditable = mode === "draft" && sheetRow?.state === "active" && canEdit;

  return (
    <div className="mt-section space-y-section">
      <Card className="p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("matrixTitle")}</h2>
        {rows.length === 0 ? (
          <div className="mt-3 space-y-1">
            <p className="text-[14px] text-ink">{t("emptyTitle")}</p>
            <p className="text-[13px] text-muted">{t("emptyBody")}</p>
            <Link
              href={`/hiring/openings/${openingId}/assessment/edit`}
              className="mt-2 inline-block text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-[120ms] ease-out hover:decoration-ink"
            >
              {t("goBuilder")}
            </Link>
          </div>
        ) : (
          <div className="mt-3">
            <Table>
              <TableHeader>
                <TableRow className="border-line hover:bg-transparent">
                  <TableHead className="text-[13px] font-medium text-muted">{t("colCompetency")}</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.id} className="tnum text-center text-[13px] font-medium text-muted">
                      {/* The number is what sighted readers match with the legend; a screen reader hears the question. */}
                      <span aria-hidden>{c.label}</span>
                      <span className="sr-only">{c.srName}</span>
                    </TableHead>
                  ))}
                  <TableHead className="text-right text-[13px] font-medium text-muted">{t("colCount")}</TableHead>
                  <TableHead className="text-[13px] font-medium text-muted">{t("colAnchors")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((row) => (
                  <TableRow key={row.id} className="h-[52px] border-line hover:bg-transparent">
                    <TableCell className="min-w-[180px] py-3 whitespace-normal">
                      <span className="text-[14px] font-medium text-ink">{row.name || t("unknownCompetency")}</span>
                      {row.measuredBy.length === 1 ? <p className="text-[12px] leading-4 text-muted">{t("singleQuestion")}</p> : null}
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.id} className="text-center">
                        {row.measuredBy.includes(c.id) ? (
                          <span className="inline-block size-2 rounded-full bg-ink" role="img" aria-label={t("measured")} />
                        ) : null}
                      </TableCell>
                    ))}
                    <TableCell className="tnum text-right text-[14px] text-ink">{row.measuredBy.length}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {row.state === "archived" ? (
                          <StatusDot tone="warn" className="font-semibold text-ink">
                            {t("anchorsArchived")}
                          </StatusDot>
                        ) : row.state === "unknown" ? (
                          <StatusDot tone="warn" className="font-semibold text-ink">
                            {t("unknownCompetency")}
                          </StatusDot>
                        ) : row.missingLevels.length ? (
                          <StatusDot tone="warn" className="font-semibold text-ink">
                            {t("anchorsMissing", { level: row.missingLevels[0] })}
                          </StatusDot>
                        ) : (
                          <StatusDot tone="done">{t("anchorsOk")}</StatusDot>
                        )}
                        {row.state !== "unknown" ? (
                          <Button
                            id={`anchors-${row.id}`}
                            variant="ghost"
                            size="sm"
                            aria-label={
                              mode === "draft" && row.state === "active" && canEdit
                                ? t("editAnchorsFor", { competency: row.name })
                                : t("viewAnchorsFor", { competency: row.name })
                            }
                            onClick={() => {
                              setAnchorsSaved(null);
                              setSheetId(row.id);
                            }}
                          >
                            {mode === "draft" && row.state === "active" && canEdit ? t("editAnchors") : t("viewAnchors")}
                          </Button>
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ul aria-label={t("legendLabel")} className="mt-3 space-y-1 border-t border-line pt-3">
              {columns.map((c) => (
                <li key={c.id} className="flex min-w-0 items-baseline gap-2 text-[13px] leading-5">
                  <span className="tnum shrink-0 font-medium text-ink">{c.label}</span>
                  <span aria-hidden className="shrink-0 text-muted">
                    ·
                  </span>
                  <span className="min-w-0 truncate text-ink-2" title={c.prompt}>
                    {c.prompt}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {choiceCount > 0 ? <p className="mt-3 text-[13px] text-muted">{t("knowledgeLine", { count: choiceCount })}</p> : null}
        <p role="status" className="mt-2 text-[13px] text-muted empty:mt-0">
          {anchorsSaved ? t("anchorsSaved", { competency: anchorsSaved }) : ""}
        </p>
      </Card>

      {rows.length > 0 ? (
        <Collapsible open={weightsOpen} onOpenChange={setWeightsOpen} className="rounded-[var(--card-radius,14px)] border border-line bg-surface">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 rounded-[var(--card-radius,14px)] p-card text-left">
            <span>
              <span className="block text-[16px] leading-6 font-semibold text-ink">{t("weightsTitle")}</span>
              <span className="tnum block text-[13px] text-muted">{enabled ? t("weightsSummaryCustom", { total: read.total }) : t("weightsSummaryEqual")}</span>
            </span>
            <ChevronDown
              className={cn("size-4 shrink-0 text-muted transition-transform duration-[180ms]", weightsOpen && "rotate-180")}
              strokeWidth={1.5}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-field px-(--card-spacing) pb-(--card-spacing) [--card-spacing:--spacing(5)]">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Switch id="weights-equal" checked={!enabled} disabled={!canEdit || pending} onCheckedChange={(equal) => setEnabled(!equal)} />
                <Label htmlFor="weights-equal" className="text-[14px] text-ink">
                  {t("weightsEqual")}
                </Label>
              </div>
              {/* Live weights start from the current set, not the profile, so only a draft names the profile. */}
              {!enabled || mode === "draft" ? <p className="text-[13px] text-muted">{enabled ? t("weightsDefaultHint") : t("weightsEqualHint")}</p> : null}
            </div>
            {enabled ? (
              <ul className="space-y-3">
                {rows.map((row) => {
                  const value = read.weights[row.id] ?? 0;
                  const invalid = faultyId === row.id;
                  return (
                    <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-x-3 gap-y-2 md:grid-cols-[minmax(0,240px)_88px_minmax(0,1fr)]">
                      <Label htmlFor={`w-${row.id}`} className="text-[14px] font-normal text-ink">
                        {row.name || t("unknownCompetency")}
                      </Label>
                      <Input
                        id={`w-${row.id}`}
                        aria-label={t("weightFor", { competency: row.name || t("unknownCompetency") })}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? "scorecard-save-why" : undefined}
                        inputMode="numeric"
                        maxLength={3}
                        className="tnum text-right"
                        value={raw[row.id] ?? ""}
                        disabled={!canEdit || pending}
                        onChange={(e) => setRaw((current) => ({ ...current, [row.id]: e.target.value }))}
                      />
                      <div className="col-span-2 h-1.5 rounded-full bg-line md:col-span-1" aria-hidden>
                        <div className="h-1.5 rounded-full bg-ink-3 transition-[width] duration-[180ms]" style={{ width: `${Math.min(100, value)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {enabled ? (
              <p aria-live="polite" className="tnum text-[14px] font-medium text-ink">
                {t("total", { total: read.total })}
              </p>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {mode === "live" && rows.length > 0 ? (
        <Card className="space-y-2 p-card">
          <Label htmlFor="weights-reason" className="text-[14px] font-medium text-ink">
            {t("reason")}
          </Label>
          <Textarea
            id="weights-reason"
            value={reason}
            maxLength={1000}
            disabled={!canEdit || pending}
            aria-describedby="weights-reason-note"
            onChange={(e) => setReason(e.target.value)}
          />
          <p id="weights-reason-note" className="text-[13px] text-muted">
            {t("liveWeightsNote")}
          </p>
        </Card>
      ) : null}

      <Card className="p-card">
        <h2 className="text-[16px] leading-6 font-semibold text-ink">{t("ruleTitle")}</h2>
        <p className="mt-2 text-[14px] leading-[22px] text-ink-2">{t("ruleBody")}</p>
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          id="scorecard-save"
          variant={sheetRow ? "secondary" : "primary"}
          onClick={save}
          disabled={pending || saveReason !== null}
          disabledReason={saveReason ?? undefined}
          aria-busy={pending || undefined}
        >
          {pending ? t("saving") : t("save")}
        </Button>
        {saveReason ? <DisabledReason id="scorecard-save-why">{saveReason}</DisabledReason> : null}
        <p role="status" className={cn("text-[13px]", outcome?.kind === "refused" ? "font-medium text-ink" : "text-muted")}>
          {outcome?.kind === "saved" ? (mode === "draft" ? t("saved") : t("savedSet")) : outcome?.kind === "refused" ? refusalText(outcome, t) : ""}
        </p>
        {outcome?.kind === "refused" && (outcome.code === "STALE" || outcome.code === "NO_DRAFT") ? (
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            {t("reload")}
          </Button>
        ) : null}
      </div>

      {sheetRow ? (
        <AnchorSheet
          key={sheetRow.id}
          openingId={openingId}
          competency={sheetRow}
          levels={levels}
          editable={sheetEditable}
          reason={anchorsReason}
          note={
            mode === "live" ? t("sheetLive", { number: liveNumber ?? 0 }) : sheetRow.state === "archived" ? t("sheetArchived") : editReason
          }
          returnFocusId={`anchors-${sheetRow.id}`}
          onClose={() => {
            setSheetId(null);
            // A Sheet opened from a readiness link (?anchors=) does not open again on reload.
            const url = new URL(window.location.href);
            if (url.searchParams.has("anchors")) {
              url.searchParams.delete("anchors");
              window.history.replaceState(null, "", `${url.pathname}${url.search}`);
            }
          }}
          onSaved={(anchors) => {
            setAdopted((current) => ({ ...current, [sheetRow.id]: anchors }));
            setAnchorsSaved(sheetRow.name);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
