"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Copy, FilePlus2, Plus, Sparkles } from "lucide-react";
import { Button, DisabledReason } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMT } from "@/i18n/manager-client";
import { POSITION_JOB_AD_MAX, POSITION_NAME_MAX } from "@/lib/library/positions";
import { createOpeningAction, type CreateOpeningActionResult } from "@/app/(manager)/hiring/openings/new/actions";

export type PositionOption = { id: string; name: string; hasJobAd: boolean; competencyCount: number; weightsEqual: boolean };
type Start = "AI" | "COPY" | "BLANK";
type Refusal = Extract<CreateOpeningActionResult, { ok: false }>["code"];

const ICONS = { AI: Sparkles, COPY: Copy, BLANK: FilePlus2 } as const;

/** HIRING-UX 5.3: one page, two blocks, not a wizard. */
export function NewOpeningForm({
  positions,
  sources,
  initialPositionId,
}: {
  positions: PositionOption[];
  sources: Array<{ id: string; name: string }>;
  initialPositionId: string | null;
}) {
  const t = useMT("hiringNew");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PositionOption | null>(positions.find((p) => p.id === initialPositionId) ?? null);
  const [newName, setNewName] = useState<string | null>(null);
  const [jobAd, setJobAd] = useState("");
  const [start, setStart] = useState<Start>("AI");
  const [copyFrom, setCopyFrom] = useState("");
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const hasAd = picked ? picked.hasJobAd : jobAd.trim().length > 0;
  // The recommended path is pre-selected, and falls back to "blank" while there is no ad.
  const effective: Start = start === "AI" && !hasAd ? "BLANK" : start;
  const positionReady = picked !== null || (newName !== null && newName.trim().length > 0);
  const reason = !positionReady ? t("needPosition") : effective === "COPY" && !copyFrom ? t("needCopySource") : null;
  const typed = query.trim();
  const exists = positions.some((p) => p.name.toLocaleLowerCase("tr") === typed.toLocaleLowerCase("tr"));

  const refusalText: Record<Refusal, string> = {
    POSITION_NAME_REQUIRED: t("needPosition"),
    POSITION_NOT_FOUND: t("positionGone"),
    JOB_AD_REQUIRED: t("startAiDisabled"),
    COPY_SOURCE_NOT_FOUND: t("copySourceGone"),
    INVALID: t("failed"),
    FAILED: t("failed"),
  };

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      try {
        const result = await createOpeningAction({
          position: picked ? { kind: "existing", id: picked.id } : { kind: "new", name: newName ?? "", jobDescription: jobAd },
          start: effective,
          copyFrom: effective === "COPY" ? copyFrom : null,
        });
        if (result.ok) router.push(result.next);
        else setRefusal(result.code);
      } catch {
        setRefusal("FAILED");
      }
    });
  }

  const options: Array<[Start, string, string]> = [
    ["AI", t("startAi"), t("startAiBody")],
    // "Önceki bir alımdan kopyala" is hidden while there is nothing to copy (HIRING-UX 5.3).
    ...(sources.length ? ([["COPY", t("startCopy"), t("startCopyBody")]] as Array<[Start, string, string]>) : []),
    ["BLANK", t("startBlank"), t("startBlankBody")],
  ];

  return (
    <div className="space-y-section">
      <Card className="space-y-field p-card">
        <h2 id="new-opening-position" className="text-[16px] leading-6 font-semibold text-ink">
          {t("stepPosition")}
        </h2>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-labelledby="new-opening-position new-opening-position-value"
              className="w-full justify-between font-normal md:w-[480px]"
            >
              <span id="new-opening-position-value" className={picked || newName ? "truncate text-ink" : "truncate text-muted"}>
                {picked?.name ?? newName ?? t("positionPick")}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            <Command>
              <CommandInput placeholder={t("positionSearch")} value={query} onValueChange={setQuery} maxLength={POSITION_NAME_MAX} />
              <CommandList>
                <CommandEmpty>{t("positionNone")}</CommandEmpty>
                {positions.length ? (
                  <CommandGroup>
                    {positions.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        keywords={[p.name]}
                        data-checked={picked?.id === p.id}
                        onSelect={() => {
                          setPicked(p);
                          setNewName(null);
                          setRefusal(null);
                          setOpen(false);
                        }}
                      >
                        {p.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {typed && !exists ? (
                  <CommandGroup forceMount>
                    <CommandItem
                      value={`__new__${typed}`}
                      keywords={[typed]}
                      forceMount
                      onSelect={() => {
                        setPicked(null);
                        setNewName(typed);
                        setRefusal(null);
                        setOpen(false);
                      }}
                    >
                      <Plus className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                      {t("positionCreate", { name: typed })}
                    </CommandItem>
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {picked ? (
          <p className="tnum text-[13px] text-muted">
            {picked.competencyCount
              ? t("profileSummary", { count: picked.competencyCount, weights: picked.weightsEqual ? t("weightsEqual") : t("weightsSet") })
              : t("profileEmpty")}
          </p>
        ) : null}
        {newName !== null ? (
          <div className="space-y-2">
            <Label htmlFor="new-opening-ad">{t("jobAd")}</Label>
            <Textarea id="new-opening-ad" rows={8} maxLength={POSITION_JOB_AD_MAX} value={jobAd} onChange={(e) => setJobAd(e.target.value)} aria-describedby="new-opening-ad-hint" />
            <p id="new-opening-ad-hint" className="text-[13px] text-muted">
              {t("jobAdHint")}
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-field p-card">
        <h2 id="new-opening-start" className="text-[16px] leading-6 font-semibold text-ink">
          {t("stepStart")}
        </h2>
        <RadioGroup
          aria-labelledby="new-opening-start"
          value={effective}
          onValueChange={(v) => setStart(v as Start)}
          className={sources.length ? "grid gap-3 md:grid-cols-3" : "grid gap-3 md:grid-cols-2"}
        >
          {options.map(([value, title, body]) => {
            const disabled = value === "AI" && !hasAd;
            const Icon = ICONS[value];
            return (
              <label
                key={value}
                className="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface p-4 transition-colors duration-[120ms] ease-out hover:border-line-strong has-[[aria-checked=true]]:border-ink has-[[aria-checked=true]]:bg-brand-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:hover:border-line"
              >
                <RadioGroupItem value={value} disabled={disabled} aria-describedby={`start-${value}`} className="mt-0.5" />
                <span className="min-w-0">
                  <span className={disabled ? "flex items-center gap-2 text-[14px] font-medium text-muted" : "flex items-center gap-2 text-[14px] font-medium text-ink"}>
                    <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    {title}
                  </span>
                  <span id={`start-${value}`} className="mt-1 block text-[13px] leading-5 text-muted">
                    {disabled ? t("startAiDisabled") : body}
                  </span>
                </span>
              </label>
            );
          })}
        </RadioGroup>
        {effective === "COPY" ? (
          <div className="max-w-[480px] space-y-2">
            <Label htmlFor="new-opening-copy">{t("copyFrom")}</Label>
            <Select value={copyFrom} onValueChange={setCopyFrom}>
              <SelectTrigger id="new-opening-copy" className="w-full">
                <SelectValue placeholder={t("copyFrom")} />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          id="new-opening-create"
          variant="primary"
          onClick={submit}
          // While pending the label itself says why ("Oluşturuluyor").
          disabled={pending || reason !== null}
          disabledReason={reason ?? undefined}
        >
          {pending ? t("creating") : t("create")}
        </Button>
        {reason ? <DisabledReason id="new-opening-create-why">{reason}</DisabledReason> : null}
        {refusal ? (
          <p role="status" className="text-[13px] text-destructive">
            {refusalText[refusal]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
