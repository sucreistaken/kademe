"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { I18nText } from "@/db/schema/types";

/** One text in Turkish and English side by side: Turkish first (RULES copy rule). */
export function I18nPair({
  label,
  value,
  onChange,
  multiline = false,
  hint,
  disabled = false,
  maxLength,
}: {
  label: string;
  value: I18nText;
  onChange: (next: I18nText) => void;
  multiline?: boolean;
  hint?: React.ReactNode;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] text-ink">{label}</Label>
      <div className="grid gap-2 md:grid-cols-2">
        {(["tr", "en"] as const).map((lang) =>
          multiline ? (
            <Textarea
              key={lang}
              aria-label={`${label} (${lang.toUpperCase()})`}
              placeholder={lang.toUpperCase()}
              value={value[lang]}
              disabled={disabled}
              maxLength={maxLength}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
            />
          ) : (
            <Input
              key={lang}
              aria-label={`${label} (${lang.toUpperCase()})`}
              placeholder={lang.toUpperCase()}
              value={value[lang]}
              disabled={disabled}
              maxLength={maxLength}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
            />
          ),
        )}
      </div>
      {hint}
    </div>
  );
}
