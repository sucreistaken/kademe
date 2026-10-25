"use client";

import { AppWindow, Check, Eye, Maximize, Monitor, PanelTop, type LucideIcon } from "lucide-react";
import { readyRules, type PlainRule } from "@/components/candidate/proctor/check-steps";
import type { CandidateMessages } from "@/i18n/candidate";
import { useT } from "@/i18n/candidate-client";
import type { ProctoringPolicy } from "@/lib/proctor/policy";
import type { RecordingLabel } from "@/lib/proctor/recording-status";
import { cn } from "@/lib/cn";

type Key = keyof CandidateMessages["examCheck"];

/** What the policy records, in the words of the exam header's own labels. */
const RECORDED_KEY = {
  cameraAudioScreen: "readyRecCameraAudioScreen",
  cameraScreen: "readyRecCameraScreen",
  cameraAudio: "readyRecCameraAudio",
  camera: "readyRecCamera",
  screen: "readyRecScreen",
} as const satisfies Record<RecordingLabel, Key>;

const PLAIN: Record<PlainRule, { icon: LucideIcon; key: Key }> = {
  fullscreen: { icon: Maximize, key: "ruleFullscreen" },
  oneScreen: { icon: Monitor, key: "ruleOneScreen" },
  tab: { icon: PanelTop, key: "ruleTab" },
};

/** The id the start button points at while it waits for the tick (aria-describedby). */
export const READY_WHY_ID = "ready-why";

/**
 * The last check screen's checklist: one card the student cannot read past.
 * The yellow callout holds the two things that matter most (close every other
 * application; the screen is recorded and the teacher sees it), the plain
 * rules sit under it, and the tick at the bottom is what unlocks the start
 * button. Yellow-soft with ink text, never red; the sizes stay at 16 and 20px
 * so the card fits a 1366x650 window next to the button.
 */
export function ReadyRules({ policy, accepted, onChange }: { policy: ProctoringPolicy; accepted: boolean; onChange: (accepted: boolean) => void }) {
  const t = useT("examCheck");
  const { recorded, plain } = readyRules(policy);
  return (
    <section aria-labelledby="ready-rules-title" className="mt-3 w-full rounded-xl border-2 border-line bg-surface p-4 text-start shadow-card">
      <h2 id="ready-rules-title" className="text-[20px] font-extrabold leading-[26px] text-ink">
        {t("readyCardTitle")}
      </h2>

      <ul data-ready-callout className="mt-2 flex flex-col gap-2 rounded-lg border-2 border-yellow-soft-lip bg-yellow-soft px-3.5 py-3">
        <Rule icon={AppWindow} tone="warn" weight="font-bold">
          {t("readyCloseApps")}
        </Rule>
        {recorded ? (
          <Rule icon={Eye} tone="warn" weight="font-bold">
            {t(RECORDED_KEY[recorded])}
          </Rule>
        ) : null}
      </ul>

      <ul className="mt-3 flex flex-col gap-1.5">
        {plain.map((id) => (
          <Rule key={id} icon={PLAIN[id].icon} tone="plain" weight="font-semibold">
            {t(PLAIN[id].key)}
          </Rule>
        ))}
      </ul>

      <label className="mt-3 flex cursor-pointer items-start gap-3 border-t-2 border-line pt-3">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          aria-required="true"
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="mt-px grid size-6 shrink-0 place-items-center rounded-sm border-2 border-line-mute bg-surface text-transparent transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent motion-reduce:transition-none"
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span className="text-[16px] font-bold leading-6 text-ink">{t("readyConfirm")}</span>
      </label>
    </section>
  );
}

function Rule({ icon: Icon, tone, weight, children }: { icon: LucideIcon; tone: "warn" | "plain"; weight: string; children: React.ReactNode }) {
  return (
    // The tile is as tall as one line (24px), so the icon sits on the first line of text however far the text wraps.
    <li className="flex items-start gap-3 text-[16px] leading-6 text-ink">
      <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-sm", tone === "warn" ? "bg-yellow text-ink" : "bg-accent-soft text-accent")}>
        <Icon className="size-[15px]" strokeWidth={2.25} />
      </span>
      <span className={weight}>{children}</span>
    </li>
  );
}
