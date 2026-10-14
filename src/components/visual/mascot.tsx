// kademe-owned
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The mascot, "Canlı basamak": the tallest step of the logo come alive, standing
 * on the two smaller steps. It is the only drawing with a face (docs/design/
 * RULES.md rule 9). Four poses: `wave` (welcome, wizard starts), `celebrate`
 * (a section or the whole exam finished, with confetti), `think` (one hand on
 * the chin, eyes up: a wizard step that asks a decision), `rest` (eyes closed,
 * a small z: empty screens). Never on a question screen.
 *
 * Hand-written inline SVG in the design tokens only (accent, mint, coral, sun,
 * grape, sky, ink and the illustration tint); hidden from assistive technology
 * (the screen's title carries the meaning). The one motion is a gentle pop on
 * `celebrate`, switched off under prefers-reduced-motion.
 */
export type MascotPose = "wave" | "celebrate" | "think" | "rest";

export const MASCOT_POSES: readonly MascotPose[] = ["wave", "celebrate", "think", "rest"];

const SIZE = {
  hero: "w-full max-w-[260px]",
  spot: "w-[160px]",
  small: "w-24",
} as const;

/** The ground shadow and the two small steps every pose stands on. */
function Steps({ stepUp = false }: { stepUp?: boolean }) {
  return (
    <>
      <ellipse cx="104" cy="182" rx="74" ry="8" className="fill-[var(--color-illus-tint)]" />
      <rect x="26" y="140" width="34" height="40" rx="12" className="fill-mint-fill" />
      <rect x="62" y="116" width="34" height="64" rx="12" className="fill-accent/70" />
      {stepUp ? null : <path d="M101 124 L88 140" strokeWidth="9" strokeLinecap="round" className="stroke-accent" />}
    </>
  );
}

/** The big step: the body every pose shares. */
function Body() {
  return <rect x="98" y="56" width="62" height="124" rx="26" className="fill-accent" />;
}

const cheeks = (y: number): ReactNode => (
  <>
    <circle cx="109" cy={y} r="5" className="fill-coral-fill opacity-70" />
    <circle cx="149" cy={y} r="5" className="fill-coral-fill opacity-70" />
  </>
);

/** Open eyes with a pupil; `up` shifts the pupils to look upwards. */
function Eyes({ up = false }: { up?: boolean }) {
  const dy = up ? -5 : 0;
  return (
    <>
      <ellipse cx="117" cy="92" rx="8" ry="9" className="fill-white" />
      <ellipse cx="141" cy="92" rx="8" ry="9" className="fill-white" />
      <circle cx="119" cy={94 + dy} r="4" className="fill-ink" />
      <circle cx="143" cy={94 + dy} r="4" className="fill-ink" />
      <circle cx="120.5" cy={92 + dy} r="1.3" className="fill-white" />
      <circle cx="144.5" cy={92 + dy} r="1.3" className="fill-white" />
    </>
  );
}

const POSES: Record<MascotPose, ReactNode> = {
  wave: (
    <>
      <Steps />
      <Body />
      <path d="M156 112 Q174 98 171 78" strokeWidth="9" strokeLinecap="round" fill="none" className="stroke-accent" />
      <circle cx="171" cy="74" r="7" className="fill-accent" />
      <Eyes />
      {cheeks(110)}
      <path d="M121 110 Q129 118 137 110" strokeWidth="3.5" strokeLinecap="round" fill="none" className="stroke-white" />
    </>
  ),
  celebrate: (
    <>
      <Steps stepUp />
      <path d="M102 112 Q86 96 88 76" strokeWidth="9" strokeLinecap="round" fill="none" className="stroke-accent" />
      <circle cx="88" cy="72" r="7" className="fill-accent" />
      <Body />
      <path d="M156 112 Q174 96 171 76" strokeWidth="9" strokeLinecap="round" fill="none" className="stroke-accent" />
      <circle cx="171" cy="72" r="7" className="fill-accent" />
      <path d="M110 93 Q117 85 124 93" strokeWidth="3.5" strokeLinecap="round" fill="none" className="stroke-white" />
      <path d="M134 93 Q141 85 148 93" strokeWidth="3.5" strokeLinecap="round" fill="none" className="stroke-white" />
      {cheeks(108)}
      <path d="M119 106 Q129 122 139 106 Z" className="fill-white" />
      <rect x="40" y="40" width="8" height="8" rx="2" className="fill-sun-fill" transform="rotate(20 44 44)" />
      <circle cx="64" cy="30" r="4" className="fill-grape-fill" />
      <circle cx="182" cy="40" r="4" className="fill-sky-fill" />
      <rect x="150" y="22" width="8" height="8" rx="2" className="fill-coral-fill" transform="rotate(-15 154 26)" />
      <circle cx="30" cy="80" r="3.5" className="fill-sky-fill" />
      <circle cx="190" cy="100" r="3.5" className="fill-sun-fill" />
    </>
  ),
  // One hand on the chin: the white edge keeps the hand readable against the body.
  think: (
    <>
      <Steps />
      <Body />
      <path d="M158 150 Q178 142 168 126 Q158 116 143 120" strokeWidth="9" strokeLinecap="round" fill="none" className="stroke-accent" />
      <circle cx="140" cy="121" r="8" strokeWidth="2.5" className="fill-accent stroke-white" />
      <Eyes up />
      {cheeks(108)}
      <path d="M118 112 Q124 109 130 112" strokeWidth="3.5" strokeLinecap="round" fill="none" className="stroke-white" />
      <circle cx="176" cy="48" r="5" className="fill-sky-fill" />
      <circle cx="166" cy="30" r="3" className="fill-sky-fill" />
    </>
  ),
  rest: (
    <>
      <Steps />
      <Body />
      <path d="M110 92 Q117 99 124 92" strokeWidth="3.5" strokeLinecap="round" fill="none" className="stroke-white" />
      <path d="M134 92 Q141 99 148 92" strokeWidth="3.5" strokeLinecap="round" fill="none" className="stroke-white" />
      {cheeks(110)}
      <path d="M124 113 Q129 117 134 113" strokeWidth="3.5" strokeLinecap="round" fill="none" className="stroke-white" />
      <path d="M172 50 H184 L172 64 H184" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-grape-fill" />
      <path d="M160 28 H168 L160 38 H168" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-grape-fill" />
    </>
  ),
};

export function Mascot({ pose, size = "spot", className }: { pose: MascotPose; size?: keyof typeof SIZE; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      data-pose={pose}
      className={cn("h-auto shrink-0", SIZE[size], pose === "celebrate" && "motion-safe:animate-[pop-in_520ms_cubic-bezier(0.2,0.8,0.2,1)_both]", className)}
    >
      {POSES[pose]}
    </svg>
  );
}
