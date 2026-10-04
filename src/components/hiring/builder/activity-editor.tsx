"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { HiringActivityConfig } from "@/db/schema";
import { useMT } from "@/i18n/manager-client";
import { cn } from "@/lib/cn";
import { ACTIVITY_TYPES, isChoice, isRecorded, MAX_COMPETENCIES_PER_ACTIVITY, type ActivityType, type ContentActivity } from "@/solutions/hiring/rules/content";
import { ColumnHeading, FieldError, invalidProps, ItemActions, type EditorBinding } from "./fields";
import { VAULT_FIELD, VAULT_SECTION } from "./stage-editor";

const FILE_TYPES = [
  ["filePdf", ["application/pdf"]],
  ["fileWord", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
  ["fileImage", ["image/png", "image/jpeg"]],
  ["fileZip", ["application/zip"]],
] as const;
const LANGS = ["tr", "en"] as const;
const MAX_CHOICES = 10;

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const whole = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);

/**
 * HIRING-UX 5.5 middle and right columns for one question. Every value saves
 * while typing (debounced) and on leaving the field; switches, chips and
 * selects save at once. The local text is never replaced by the server's
 * answer, so a slow or failed save loses nothing.
 */
export function ActivityEditor({
  activity,
  index,
  count,
  competencies,
  binding,
  autoFocus,
  onChangeType,
  onSetCompetencies,
  onMove,
  onDelete,
}: {
  activity: ContentActivity;
  index: number;
  count: number;
  competencies: Array<{ id: string; name: string; archived: boolean }>;
  binding: EditorBinding;
  autoFocus: boolean;
  /** Resolves false when the server refused the new type; the select then shows the old one again. */
  onChangeType: (type: ActivityType) => Promise<boolean>;
  onSetCompetencies: (ids: string[]) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const t = useMT("hiringBuilder");
  const { editable, onEdit, onFlush, errorFor } = binding;
  const [a, setA] = useState(activity);
  const [behaviours, setBehaviours] = useState(activity.expectedBehaviours.join("\n"));
  const [redFlags, setRedFlags] = useState(activity.redFlags.join("\n"));
  const [numbers, setNumbers] = useState({
    thinkSeconds: String(activity.thinkSeconds),
    answerSeconds: activity.answerSeconds === null ? "" : String(activity.answerSeconds),
    minChars: activity.config.minChars === undefined ? "" : String(activity.config.minChars),
    maxChars: activity.config.maxChars === undefined ? "" : String(activity.config.maxChars),
    maxFileMb: activity.config.maxFileBytes ? String(Math.round(activity.config.maxFileBytes / 1024 / 1024)) : "",
  });
  const [wholeErrors, setWholeErrors] = useState<Partial<Record<keyof typeof numbers, boolean>>>({});

  const update = <K extends keyof ContentActivity>(field: K, value: ContentActivity[K], save: unknown = value) => {
    setA((current) => ({ ...current, [field]: value }));
    onEdit(field, save);
  };
  const setConfig = (config: HiringActivityConfig, now = false) => {
    update("config", config);
    if (now) onFlush();
  };
  /** A number field: a whole number is saved (the server checks the range), anything else is said at once. */
  const number = (key: keyof typeof numbers, raw: string, save: (value: number) => void) => {
    setNumbers((n) => ({ ...n, [key]: raw }));
    const v = whole(raw);
    setWholeErrors((e) => ({ ...e, [key]: v === null }));
    if (v !== null) save(v);
  };
  const numberError = (key: keyof typeof numbers, field: string) => (wholeErrors[key] ? t("errWhole") : errorFor(field));
  const choices = a.config.choices ?? [];
  const toggle = (field: "required" | "flexibleThink", on: boolean) => {
    update(field, on);
    onFlush();
  };

  return (
    <>
      <section className="space-y-field rounded-xl border border-line bg-surface p-card" aria-label={t("candidateSide")}>
        <ColumnHeading>{t("candidateSide")}</ColumnHeading>
        <Tabs defaultValue="tr">
          <TabsList aria-label={t("languageTabs")}>
            <TabsTrigger value="tr">TR</TabsTrigger>
            <TabsTrigger value="en">EN</TabsTrigger>
          </TabsList>
          {LANGS.map((lang) => {
            const promptError = errorFor(`prompt.${lang}`) ?? errorFor("prompt");
            const noteError = errorFor(`note.${lang}`) ?? errorFor("note");
            return (
              <TabsContent key={lang} value={lang} className="space-y-field pt-3">
                <div className="space-y-2">
                  <Label htmlFor={`prompt-${lang}`}>{`${t("prompt")} (${lang.toUpperCase()})`}</Label>
                  <Textarea
                    id={`prompt-${lang}`}
                    rows={4}
                    className="text-[16px] leading-6"
                    value={a.prompt[lang]}
                    readOnly={!editable}
                    autoFocus={autoFocus && lang === "tr"}
                    onChange={(e) => update("prompt", { ...a.prompt, [lang]: e.target.value })}
                    onBlur={onFlush}
                    {...invalidProps(`prompt-${lang}`, promptError)}
                  />
                  <FieldError id={`prompt-${lang}`} error={promptError} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`note-${lang}`}>{`${t("note")} (${lang.toUpperCase()})`}</Label>
                  <Textarea
                    id={`note-${lang}`}
                    value={a.note[lang]}
                    readOnly={!editable}
                    onChange={(e) => update("note", { ...a.note, [lang]: e.target.value })}
                    onBlur={onFlush}
                    {...invalidProps(`note-${lang}`, noteError)}
                  />
                  <FieldError id={`note-${lang}`} error={noteError} />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        <div className="grid gap-field sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="activity-type">{t("type")}</Label>
            <Select
              value={a.type}
              disabled={!editable}
              onValueChange={(type) => {
                const previous = a.type;
                setA((current) => ({ ...current, type: type as ActivityType }));
                void onChangeType(type as ActivityType).then((ok) => {
                  if (!ok) setA((current) => ({ ...current, type: previous }));
                });
              }}
            >
              <SelectTrigger id="activity-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`type${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 sm:pt-7">
            <Switch id="activity-required" checked={a.required} disabled={!editable} onCheckedChange={(on) => toggle("required", on)} />
            <Label htmlFor="activity-required" className="text-[14px] font-normal text-ink">
              {t("required")}
            </Label>
          </div>
        </div>

        {isRecorded(a.type) ? (
          <div className="grid gap-field sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="think">{t("thinkSeconds")}</Label>
              <Input
                id="think"
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                className="tnum"
                value={numbers.thinkSeconds}
                readOnly={!editable}
                onChange={(e) => number("thinkSeconds", e.target.value, (v) => update("thinkSeconds", v))}
                onBlur={onFlush}
                {...invalidProps("think", numberError("thinkSeconds", "thinkSeconds"))}
              />
              <FieldError id="think" error={numberError("thinkSeconds", "thinkSeconds")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">{t("answerSeconds")}</Label>
              <Input
                id="answer"
                type="number"
                inputMode="numeric"
                min={30}
                max={1800}
                className="tnum"
                value={numbers.answerSeconds}
                readOnly={!editable}
                onChange={(e) => number("answerSeconds", e.target.value, (v) => update("answerSeconds", v))}
                onBlur={onFlush}
                {...invalidProps("answer", numberError("answerSeconds", "answerSeconds"))}
              />
              <FieldError id="answer" error={numberError("answerSeconds", "answerSeconds")} />
            </div>
            <div className="flex items-start gap-3 sm:col-span-2">
              <Switch id="flexible-think" className="mt-0.5" checked={a.flexibleThink} disabled={!editable} onCheckedChange={(on) => toggle("flexibleThink", on)} />
              <Label htmlFor="flexible-think" className="text-[14px] leading-5 font-normal text-ink">
                {t("flexibleThink")}
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="takes">{t("takes")}</Label>
              <Select
                value={String(a.maxTakes)}
                disabled={!editable}
                onValueChange={(v) => {
                  update("maxTakes", Number(v));
                  onFlush();
                }}
              >
                <SelectTrigger id="takes" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("takes1")}</SelectItem>
                  <SelectItem value="2">{t("takes2")}</SelectItem>
                  <SelectItem value="3">{t("takes3")}</SelectItem>
                </SelectContent>
              </Select>
              <FieldError id="takes" error={errorFor("maxTakes")} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="flex items-start gap-3">
                <Switch
                  id="text-alternative"
                  className="mt-0.5"
                  checked={a.config.textAlternativeEnabled ?? false}
                  disabled={!editable}
                  aria-describedby="text-alternative-hint"
                  onCheckedChange={(on) => setConfig({ ...a.config, textAlternativeEnabled: on }, true)}
                />
                <Label htmlFor="text-alternative" className="text-[14px] leading-5 font-normal text-ink">
                  {t("textAlternative")}
                </Label>
              </div>
              <p id="text-alternative-hint" className="pl-[44px] text-[13px] text-muted">
                {t("textAlternativeHint")}
              </p>
            </div>
          </div>
        ) : null}

        {a.type === "LONG_TEXT" || a.type === "SHORT_TEXT" ? (
          <div className="grid gap-field sm:grid-cols-2">
            {(["minChars", "maxChars"] as const).map((key) => {
              const error = numberError(key, `config.${key}`);
              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{t(key)}</Label>
                  <Input
                    id={key}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={20000}
                    className="tnum"
                    value={numbers[key]}
                    readOnly={!editable}
                    onChange={(e) => number(key, e.target.value, (v) => setConfig({ ...a.config, [key]: v }))}
                    onBlur={onFlush}
                    {...invalidProps(key, error)}
                  />
                  <FieldError id={key} error={error} />
                </div>
              );
            })}
          </div>
        ) : null}

        {isChoice(a.type) ? (
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm leading-none font-medium text-ink">{t("choices")}</legend>
            <ChoiceList
              type={a.type}
              choices={choices}
              editable={editable}
              onChange={(next, now) => setConfig({ ...a.config, choices: next }, now)}
              onFlush={onFlush}
            />
            <FieldError id="choices" error={errorFor("config.choices") ?? errorFor("config")} />
            {editable ? (
              choices.length < MAX_CHOICES ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfig({ ...a.config, choices: [...choices, { id: crypto.randomUUID().slice(0, 8), label: { tr: "", en: "" } }] }, true)}
                >
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                  {t("addChoice")}
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="ghost" size="sm" disabled disabledReason={t("choiceMax")} id="add-choice">
                    <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                    {t("addChoice")}
                  </Button>
                  <DisabledReason id="add-choice-why">{t("choiceMax")}</DisabledReason>
                </div>
              )
            ) : null}
            <p className="text-[13px] text-muted">
              {a.type === "SINGLE_CHOICE" ? `${t("choiceSingleNote")} ` : ""}
              {t("choiceKeyNote")}
            </p>
          </fieldset>
        ) : null}

        {a.type === "FILE_UPLOAD" ? (
          <div className="space-y-3">
            <fieldset>
              <legend className="mb-3 text-sm leading-none font-medium text-ink">{t("fileTypes")}</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {FILE_TYPES.map(([key, mimes]) => {
                  const on = mimes.every((m) => (a.config.acceptedMimeTypes ?? []).includes(m));
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`file-${key}`}
                        checked={on}
                        disabled={!editable}
                        onCheckedChange={(checked) => {
                          const current = (a.config.acceptedMimeTypes ?? []).filter((m) => !(mimes as readonly string[]).includes(m));
                          setConfig({ ...a.config, acceptedMimeTypes: checked === true ? [...current, ...mimes] : current }, true);
                        }}
                      />
                      <Label htmlFor={`file-${key}`} className="text-[14px] font-normal text-ink">
                        {t(key)}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
            <div className="max-w-[200px] space-y-2">
              <Label htmlFor="max-mb">{t("maxFileMb")}</Label>
              <Input
                id="max-mb"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                className="tnum"
                value={numbers.maxFileMb}
                readOnly={!editable}
                onChange={(e) => number("maxFileMb", e.target.value, (v) => setConfig({ ...a.config, maxFileBytes: v * 1024 * 1024 }))}
                onBlur={onFlush}
                {...invalidProps("max-mb", numberError("maxFileMb", "config.maxFileBytes"))}
              />
              <FieldError id="max-mb" error={numberError("maxFileMb", "config.maxFileBytes")} />
            </div>
          </div>
        ) : null}

        {editable ? <ItemActions idPrefix="activity" index={index} count={count} onMove={onMove} onDelete={onDelete} deleteLabel={t("deleteActivity")} /> : null}
      </section>

      <section className={VAULT_SECTION} aria-label={t("teamSide")}>
        <ColumnHeading tone="vault">{t("teamSide")}</ColumnHeading>
        <div className="space-y-2">
          <Label htmlFor="purpose" className="text-vault-label">
            {t("purpose")}
          </Label>
          <Textarea
            id="purpose"
            className={VAULT_FIELD}
            value={a.internalQuestion ?? ""}
            readOnly={!editable}
            onChange={(e) => update("internalQuestion", e.target.value, e.target.value.trim() || null)}
            onBlur={onFlush}
            {...invalidProps("purpose", errorFor("internalQuestion"))}
          />
          <FieldError id="purpose" error={errorFor("internalQuestion")} tone="vault" />
        </div>
        <div className="space-y-2" role="group" aria-labelledby="competencies-label">
          <p id="competencies-label" className="text-[13px] text-vault-label">
            {t("competencies")}
          </p>
          {isChoice(a.type) ? (
            <p className="text-[13px] text-vault-text">{t("choiceNoCompetency")}</p>
          ) : competencies.length === 0 ? (
            <p className="text-[13px] text-vault-text">{t("noCompetencies")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {competencies
                  .filter((c) => !c.archived || a.competencyIds.includes(c.id))
                  .map((c) => {
                    const on = a.competencyIds.includes(c.id);
                    const blocked = !on && a.competencyIds.length >= MAX_COMPETENCIES_PER_ACTIVITY;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!editable || blocked}
                        aria-describedby={blocked ? "competency-limit" : undefined}
                        onClick={() => {
                          const ids = on ? a.competencyIds.filter((x) => x !== c.id) : [...a.competencyIds, c.id];
                          setA((current) => ({ ...current, competencyIds: ids }));
                          onSetCompetencies(ids);
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-[120ms] ease-out",
                          on ? "border-vault-text bg-vault-text font-medium text-vault" : "border-vault-chip text-vault-text hover:border-vault-text",
                          blocked && "cursor-not-allowed opacity-50 hover:border-vault-chip",
                          !editable && "cursor-default",
                        )}
                      >
                        {c.name}
                        {c.archived ? ` (${t("archived")})` : ""}
                      </button>
                    );
                  })}
              </div>
              {editable && a.competencyIds.length >= MAX_COMPETENCIES_PER_ACTIVITY ? (
                <p id="competency-limit" className="text-[13px] text-vault-label">
                  {t("competencyLimit")}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-[13px] text-vault-label">{t("examplesTitle")}</p>
            <p className="mt-0.5 text-[12px] leading-4 text-vault-label">{t("examplesHint")}</p>
          </div>
          {([1, 3, 5] as const).map((level) => (
            <div key={level} className="space-y-1">
              <Label htmlFor={`example-${level}`} className="text-vault-label">
                {t(`example${level}`)}
              </Label>
              <Textarea
                id={`example-${level}`}
                className={VAULT_FIELD}
                value={a.answerExamples[level] ?? ""}
                readOnly={!editable}
                onChange={(e) => update("answerExamples", { ...a.answerExamples, [level]: e.target.value })}
                onBlur={onFlush}
                {...invalidProps(`example-${level}`, errorFor(`answerExamples.${level}`))}
              />
              <FieldError id={`example-${level}`} error={errorFor(`answerExamples.${level}`)} tone="vault" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="behaviours" className="text-vault-label">
            {t("behaviours")}
          </Label>
          <Textarea
            id="behaviours"
            className={VAULT_FIELD}
            value={behaviours}
            readOnly={!editable}
            onChange={(e) => {
              setBehaviours(e.target.value);
              onEdit("expectedBehaviours", lines(e.target.value));
            }}
            onBlur={onFlush}
            {...invalidProps("behaviours", errorFor("expectedBehaviours"))}
          />
          <FieldError id="behaviours" error={errorFor("expectedBehaviours")} tone="vault" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="red-flags" className="text-vault-label">
            {t("redFlags")}
          </Label>
          <Textarea
            id="red-flags"
            className={VAULT_FIELD}
            value={redFlags}
            readOnly={!editable}
            onChange={(e) => {
              setRedFlags(e.target.value);
              onEdit("redFlags", lines(e.target.value));
            }}
            onBlur={onFlush}
            {...invalidProps("red-flags", errorFor("redFlags"))}
          />
          <FieldError id="red-flags" error={errorFor("redFlags")} tone="vault" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manager-notes" className="text-vault-label">
            {t("managerNotes")}
          </Label>
          <Textarea
            id="manager-notes"
            className={VAULT_FIELD}
            value={a.managerNotes ?? ""}
            readOnly={!editable}
            onChange={(e) => update("managerNotes", e.target.value, e.target.value.trim() || null)}
            onBlur={onFlush}
            {...invalidProps("manager-notes", errorFor("managerNotes"))}
          />
          <FieldError id="manager-notes" error={errorFor("managerNotes")} tone="vault" />
        </div>
      </section>
    </>
  );
}

/**
 * Options of a choice question. A single choice marks its right answer with a
 * radio (one only); a multiple choice with checkboxes. Labels save while
 * typing; adding, removing and marking save at once.
 */
function ChoiceList({
  type,
  choices,
  editable,
  onChange,
  onFlush,
}: {
  type: ActivityType;
  choices: NonNullable<HiringActivityConfig["choices"]>;
  editable: boolean;
  onChange: (next: NonNullable<HiringActivityConfig["choices"]>, now: boolean) => void;
  onFlush: () => void;
}) {
  const t = useMT("hiringBuilder");
  const single = type === "SINGLE_CHOICE";
  const correctId = choices.find((c) => c.correct === true)?.id ?? "";
  const rows = choices.map((choice, i) => (
    <div key={choice.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
      <div className="flex items-center">
        {single ? (
          <RadioGroupItem id={`choice-correct-${choice.id}`} value={choice.id} aria-label={t("choiceCorrectOf", { n: i + 1 })} />
        ) : (
          <Checkbox
            id={`choice-correct-${choice.id}`}
            checked={choice.correct === true}
            disabled={!editable}
            aria-label={t("choiceCorrectOf", { n: i + 1 })}
            onCheckedChange={(checked) => onChange(choices.map((c) => (c.id === choice.id ? { ...c, correct: checked === true } : c)), true)}
          />
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {LANGS.map((lang) => (
          <Input
            key={lang}
            placeholder={lang.toUpperCase()}
            aria-label={t("choiceLabel", { n: i + 1, lang: lang.toUpperCase() })}
            value={choice.label[lang]}
            readOnly={!editable}
            onChange={(e) => onChange(choices.map((c) => (c.id === choice.id ? { ...c, label: { ...c.label, [lang]: e.target.value } } : c)), false)}
            onBlur={onFlush}
          />
        ))}
      </div>
      {editable ? (
        <Button variant="ghost" size="icon-sm" aria-label={t("removeChoiceOf", { n: i + 1 })} onClick={() => onChange(choices.filter((c) => c.id !== choice.id), true)}>
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </Button>
      ) : (
        <span />
      )}
    </div>
  ));
  if (!single) return <div className="space-y-2">{rows}</div>;
  return (
    <RadioGroup
      value={correctId}
      disabled={!editable}
      aria-label={t("choiceCorrect")}
      className="space-y-2"
      onValueChange={(id) => onChange(choices.map((c) => ({ ...c, correct: c.id === id })), true)}
    >
      {rows}
    </RadioGroup>
  );
}
