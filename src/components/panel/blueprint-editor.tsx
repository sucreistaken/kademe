"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { archiveBlueprint, copyBlueprint, publishBlueprint, saveBlueprint } from "@/app/(manager)/exam/exams/actions";
import { bankCoverage, estimatedMinutes, type BankCount, type BlueprintConfig, type SectionConfig } from "@/lib/exam/blueprint";
import { isObjectiveSection, type ExamMode } from "@/lib/exam/types";
import { PRESETS, type PolicyPreset, type ProctoringPolicy } from "@/lib/proctor/policy";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";

/**
 * The exam editor, laid out like the builder the product already had: the
 * left column is what the student sees, the dark right column is for the
 * teacher only. Every change saves by itself. The bar at the bottom checks the
 * question bank live and holds the one filled button, Publish, which stays off
 * with its reason while anything is missing.
 */
export function BlueprintEditor({
  id,
  mode,
  initialName,
  initialDescription,
  initialConfig,
  status,
  counts,
}: {
  id: string;
  mode: ExamMode;
  initialName: string;
  initialDescription: string;
  initialConfig: BlueprintConfig;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  counts: BankCount[];
}) {
  const t = useMT("exams");
  const sec = useMT("sectionName");
  const inv = useMT("invite");
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [cfg, setCfg] = useState<BlueprintConfig>(initialConfig);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const readOnly = status !== "DRAFT";
  const first = useRef(true);

  useEffect(() => {
    if (readOnly) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      const r = await saveBlueprint(id, { name, description, config: cfg });
      if (r.ok) {
        setSaved(new Date(r.at).toLocaleTimeString().slice(0, 5));
        setError(null);
      } else setError(r.error);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [id, name, description, cfg, readOnly]);

  const coverage = useMemo(() => bankCoverage(counts, cfg, mode, null), [counts, cfg, mode]);
  const missing = coverage.rows.filter((r) => !r.ok);

  const setSection = (section: string, patch: Partial<SectionConfig>) =>
    setCfg((c) => ({ ...c, sections: c.sections.map((s) => (s.section === section ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) =>
    setCfg((c) => {
      const s = [...c.sections];
      const j = i + d;
      if (j < 0 || j >= s.length) return c;
      [s[i], s[j]] = [s[j], s[i]];
      return { ...c, sections: s };
    });
  const setPolicy = (patch: Partial<ProctoringPolicy>) => setCfg((c) => ({ ...c, proctoring: { ...c.proctoring, ...patch } }));

  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || lo)));
  const field = "h-9 rounded-[8px] border border-line bg-surface px-2 text-[13.5px] text-ink disabled:bg-canvas";
  const vfield = "h-8 w-full rounded-[6px] border border-vault-line bg-vault-box px-2 text-[13px] text-vault-text disabled:opacity-60";
  const vlabel = "block text-[11.5px] text-vault-label";

  return (
    <div className="pb-28">
      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        {/* What the student sees */}
        <section>
          <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted">{t("studentSees")}</div>
          <input
            value={name}
            disabled={readOnly}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full bg-transparent text-[26px] font-bold tracking-[-0.02em] text-ink outline-none"
          />
          <textarea
            value={description}
            disabled={readOnly}
            placeholder={t("description")}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-none bg-transparent text-[14px] text-muted outline-none"
          />
          <ol className="mt-4 flex flex-col gap-2.5">
            {cfg.sections.map((s, i) => (
              <li key={s.section} className={cn("rounded-[12px] border border-line bg-surface px-4 py-3", !s.enabled && "opacity-55")}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex flex-col">
                    <button type="button" aria-label="up" disabled={readOnly || i === 0} onClick={() => move(i, -1)} className="text-[10px] leading-none text-muted disabled:opacity-30">
                      ▲
                    </button>
                    <button type="button" aria-label="down" disabled={readOnly || i === cfg.sections.length - 1} onClick={() => move(i, 1)} className="text-[10px] leading-none text-muted disabled:opacity-30">
                      ▼
                    </button>
                  </span>
                  <label className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
                    <input type="checkbox" checked={s.enabled} disabled={readOnly} onChange={(e) => setSection(s.section, { enabled: e.target.checked })} className="accent-accent" />
                    {sec(s.section)}
                  </label>
                  <label className="ml-auto flex items-center gap-2 text-[12.5px] text-muted">
                    {t("duration")}
                    <input type="number" min={1} max={180} value={s.durationMinutes} disabled={readOnly || !s.enabled} onChange={(e) => setSection(s.section, { durationMinutes: num(e.target.value, 1, 180) })} className={cn(field, "w-16")} />
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <p className="tnum mt-3 text-[13px] text-muted">{t("estimated", { n: estimatedMinutes(cfg) })}</p>
          {readOnly ? <p className="mt-4 text-[13px] text-ink-2">{t("published")}</p> : null}
        </section>

        {/* Teacher only */}
        <section className="rounded-[14px] bg-vault p-5 text-vault-text">
          <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-vault-label">{t("teacherOnly")}</div>
          <div className="mt-3 flex flex-col gap-4">
            {cfg.sections
              .filter((s) => s.enabled)
              .map((s) => (
                <div key={s.section} className="rounded-[10px] border border-vault-line p-3">
                  <div className="text-[13px] font-semibold">{sec(s.section)}</div>
                  {isObjectiveSection(s.section) ? (
                    <>
                      <label className="mt-2 flex items-center gap-2 text-[12.5px]">
                        <input type="checkbox" checked={s.adaptive} disabled={readOnly} onChange={(e) => setSection(s.section, { adaptive: e.target.checked })} className="accent-accent" />
                        {t("adaptive")}
                      </label>
                      {s.adaptive ? (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <label className={vlabel}>
                            {t("minItems")}
                            <input type="number" value={s.minItems} disabled={readOnly} onChange={(e) => setSection(s.section, { minItems: num(e.target.value, 1, 60) })} className={vfield} />
                          </label>
                          <label className={vlabel}>
                            {t("maxItems")}
                            <input type="number" value={s.maxItems} disabled={readOnly} onChange={(e) => setSection(s.section, { maxItems: num(e.target.value, 1, 80) })} className={vfield} />
                          </label>
                          <label className={vlabel}>
                            {t("targetSe")}
                            <input type="number" step={0.05} value={s.targetSe} disabled={readOnly} onChange={(e) => setSection(s.section, { targetSe: Math.max(0.2, Math.min(1, Number(e.target.value) || 0.45)) })} className={vfield} />
                          </label>
                        </div>
                      ) : s.distribution.kind === "RELATIVE" ? (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {(["below", "at", "above"] as const).map((k) => (
                            <label key={k} className={vlabel}>
                              {t(k)}
                              <input
                                type="number"
                                value={s.distribution.kind === "RELATIVE" ? s.distribution[k] : 0}
                                disabled={readOnly}
                                onChange={(e) =>
                                  setSection(s.section, {
                                    distribution: { ...(s.distribution as Extract<SectionConfig["distribution"], { kind: "RELATIVE" }>), [k]: num(e.target.value, 0, 60) },
                                  })
                                }
                                className={vfield}
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <label className={vlabel}>
                        {t("tasks")}
                        <input type="number" value={s.tasks} disabled={readOnly} onChange={(e) => setSection(s.section, { tasks: num(e.target.value, 1, 4) })} className={vfield} />
                      </label>
                      {s.section === "SPEAKING" ? (
                        <>
                          <label className={vlabel}>
                            {t("thinkSeconds")}
                            <input type="number" placeholder={t("itemDefault")} value={s.thinkSeconds ?? ""} disabled={readOnly} onChange={(e) => setSection(s.section, { thinkSeconds: e.target.value === "" ? null : num(e.target.value, 0, 300) })} className={vfield} />
                          </label>
                          <label className={vlabel}>
                            {t("answerSeconds")}
                            <input type="number" placeholder={t("itemDefault")} value={s.answerSeconds ?? ""} disabled={readOnly} onChange={(e) => setSection(s.section, { answerSeconds: e.target.value === "" ? null : num(e.target.value, 20, 600) })} className={vfield} />
                          </label>
                          <label className={vlabel}>
                            {t("maxTakes")}
                            <input type="number" placeholder={t("itemDefault")} value={s.maxTakes ?? ""} disabled={readOnly} onChange={(e) => setSection(s.section, { maxTakes: e.target.value === "" ? null : num(e.target.value, 1, 3) })} className={vfield} />
                          </label>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}

            <div className="rounded-[10px] border border-vault-line p-3">
              <div className="text-[13px] font-semibold">{t("general")}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className={vlabel}>
                  {t("difficultyOffset")}
                  <select value={cfg.difficultyOffset} disabled={readOnly} onChange={(e) => setCfg({ ...cfg, difficultyOffset: Number(e.target.value) as -1 | 0 | 1 })} className={vfield}>
                    <option value={-1}>-1</option>
                    <option value={0}>0</option>
                    <option value={1}>+1</option>
                  </select>
                </label>
                <label className={vlabel}>
                  {t("listeningPlays")}
                  <input type="number" value={cfg.listening.maxPlays} disabled={readOnly} onChange={(e) => setCfg({ ...cfg, listening: { maxPlays: num(e.target.value, 1, 3) } })} className={vfield} />
                </label>
                <label className={cn(vlabel, "col-span-2")}>
                  {t("visibility")}
                  <select value={cfg.resultVisibility} disabled={readOnly} onChange={(e) => setCfg({ ...cfg, resultVisibility: e.target.value as BlueprintConfig["resultVisibility"] })} className={vfield}>
                    <option value="NONE">{t("visNONE")}</option>
                    <option value="OVERALL">{t("visOVERALL")}</option>
                    <option value="FULL">{t("visFULL")}</option>
                  </select>
                </label>
                <label className="col-span-2 flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" checked={cfg.autoRelease} disabled={readOnly || cfg.resultVisibility === "NONE"} onChange={(e) => setCfg({ ...cfg, autoRelease: e.target.checked })} className="accent-accent" />
                  {t("autoRelease")}
                </label>
              </div>
            </div>

            {mode === "LEVEL_VERIFICATION" ? (
              <div className="rounded-[10px] border border-vault-line p-3">
                <div className="text-[13px] font-semibold">{t("passRules")}</div>
                <label className="mt-2 flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" checked={cfg.passRules.overallAtLeastClaimed} disabled={readOnly} onChange={(e) => setCfg({ ...cfg, passRules: { ...cfg.passRules, overallAtLeastClaimed: e.target.checked } })} className="accent-accent" />
                  {t("overallAtLeastClaimed")}
                </label>
                <label className={cn(vlabel, "mt-2")}>
                  <select
                    value={cfg.passRules.minSkillOffset ?? "none"}
                    disabled={readOnly}
                    onChange={(e) => setCfg({ ...cfg, passRules: { ...cfg.passRules, minSkillOffset: e.target.value === "none" ? null : Number(e.target.value) } })}
                    className={vfield}
                  >
                    <option value="none">{t("noSkillRule")}</option>
                    <option value={0}>{t("minSkillOffset", { offset: "" })}</option>
                    <option value={-1}>{t("minSkillOffset", { offset: "-1" })}</option>
                    <option value={-2}>{t("minSkillOffset", { offset: "-2" })}</option>
                  </select>
                </label>
                <label className={cn(vlabel, "mt-2")}>
                  {t("minHold")}
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={0.99}
                    value={cfg.passRules.minHoldProbability ?? ""}
                    disabled={readOnly}
                    onChange={(e) => setCfg({ ...cfg, passRules: { ...cfg.passRules, minHoldProbability: e.target.value === "" ? null : Math.max(0, Math.min(0.99, Number(e.target.value))) } })}
                    className={vfield}
                  />
                </label>
              </div>
            ) : null}

            <div className="rounded-[10px] border border-vault-line p-3">
              <div className="text-[13px] font-semibold">{t("proctoring")}</div>
              <div className="mt-2 flex gap-1.5">
                {(["OFF", "STANDARD", "STRICT"] as PolicyPreset[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setCfg({ ...cfg, proctoring: { ...PRESETS[p], termination: cfg.proctoring.termination } })}
                    className={cn(
                      "h-8 flex-1 rounded-[6px] border text-[12.5px]",
                      cfg.proctoring.preset === p ? "border-vault-text bg-vault-box font-semibold" : "border-vault-line text-vault-label",
                    )}
                  >
                    {inv(`preset${p}`)}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setCustom((v) => !v)} className="mt-2 text-[12px] text-vault-label underline underline-offset-2">
                {t("customize")}
              </button>
              {custom ? (
                <div className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
                  {(
                    [
                      ["camera", t("pCamera")],
                      ["microphone", t("pMicrophone")],
                      ["screenShare", t("pScreenShare")],
                      ["fullscreen", t("pFullscreen")],
                      ["clipboardBlock", t("pClipboard")],
                      ["aiSecondLook", t("pAiSecondLook")],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="checkbox" checked={cfg.proctoring[k]} disabled={readOnly} onChange={(e) => setPolicy({ [k]: e.target.checked } as Partial<ProctoringPolicy>)} className="accent-accent" />
                      {label}
                    </label>
                  ))}
                  {(["face", "gaze", "phone", "voice"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="checkbox" checked={cfg.proctoring.aiSignals[k]} disabled={readOnly} onChange={(e) => setPolicy({ aiSignals: { ...cfg.proctoring.aiSignals, [k]: e.target.checked } })} className="accent-accent" />
                      {t(k === "face" ? "pAiFace" : k === "gaze" ? "pAiGaze" : k === "phone" ? "pAiPhone" : "pAiVoice")}
                    </label>
                  ))}
                  <label className={vlabel}>
                    {t("pSecondScreen")}
                    <select value={cfg.proctoring.secondScreen} disabled={readOnly} onChange={(e) => setPolicy({ secondScreen: e.target.value as ProctoringPolicy["secondScreen"] })} className={vfield}>
                      <option value="OFF">{t("pSecondOFF")}</option>
                      <option value="WARN">{t("pSecondWARN")}</option>
                      <option value="BLOCK_AT_CHECK">{t("pSecondBLOCK")}</option>
                    </select>
                  </label>
                  <label className={vlabel}>
                    {t("pBrowser")}
                    <select value={cfg.proctoring.browserPolicy} disabled={readOnly} onChange={(e) => setPolicy({ browserPolicy: e.target.value as ProctoringPolicy["browserPolicy"] })} className={vfield}>
                      <option value="CHROMIUM_ONLY">{t("pChromium")}</option>
                      <option value="ANY_DESKTOP">{t("pAnyDesktop")}</option>
                    </select>
                  </label>
                  <div className="mt-2 border-t border-vault-line pt-2">
                    <label className="flex items-center gap-2 font-semibold">
                      <input type="checkbox" checked={cfg.proctoring.termination.enabled} disabled={readOnly} onChange={(e) => setPolicy({ termination: { ...cfg.proctoring.termination, enabled: e.target.checked } })} className="accent-accent" />
                      {t("termination")}
                    </label>
                    <p className="mt-1 text-[11.5px] text-vault-label">{t("terminationNote")}</p>
                    {cfg.proctoring.termination.enabled ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className={vlabel}>
                          {t("terminationShare")}
                          <input type="number" value={cfg.proctoring.termination.screenShareGoneSeconds} disabled={readOnly} onChange={(e) => setPolicy({ termination: { ...cfg.proctoring.termination, screenShareGoneSeconds: num(e.target.value, 10, 600) } })} className={vfield} />
                        </label>
                        <label className={vlabel}>
                          {t("terminationExits")}
                          <input type="number" value={cfg.proctoring.termination.fullscreenExitMax} disabled={readOnly} onChange={(e) => setPolicy({ termination: { ...cfg.proctoring.termination, fullscreenExitMax: num(e.target.value, 1, 50) } })} className={vfield} />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* Sticky bar: coverage, length, one action */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 shadow-panel backdrop-blur">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-6 py-3">
          <span className={cn("text-[13px]", missing.length ? "text-ink" : "text-muted")}>
            {missing.length
              ? t("coverageMissing", { list: missing.slice(0, 4).map((m) => `${sec(m.section)} ${m.level}`).join(", ") + (missing.length > 4 ? ` +${missing.length - 4}` : "") })
              : t("coverageOk")}
          </span>
          <span className="tnum text-[13px] text-muted">{t("estimated", { n: estimatedMinutes(cfg) })}</span>
          <span className="text-[12.5px] text-muted">{error ? t("saveFailed", { reason: error }) : saved ? `${t("saved")} ${saved}` : ""}</span>
          <span className="ml-auto flex items-center gap-2">
            {status === "DRAFT" ? (
              <form action={publishBlueprint}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" disabled={missing.length > 0} className="h-10 rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
                  {t("publish")}
                </button>
              </form>
            ) : (
              <form action={copyBlueprint}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className="h-10 rounded-[10px] border border-line-strong px-4 text-[14px] font-medium text-ink hover:bg-canvas">
                  {t("copyEdit")}
                </button>
              </form>
            )}
            <form action={archiveBlueprint}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="h-10 px-3 text-[13px] text-muted underline underline-offset-2 hover:text-ink">
                {t("archive")}
              </button>
            </form>
          </span>
          {status === "DRAFT" && missing.length > 0 ? <span className="w-full text-right text-[12px] text-muted">{t("publishBlocked")}</span> : null}
        </div>
      </div>
    </div>
  );
}
