// kademe-owned
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The mascot, "Canlı basamak": the tallest step of the logo come alive, standing
 * on the two smaller steps. It is the only drawing with a face (docs/design/
 * RULES.md rule 9). Five poses: `wave` (welcome, wizard starts), `celebrate`
 * (a section or the whole exam finished, with confetti), `think` (one hand on
 * the chin, eyes up: a wizard step that asks a decision), `rest` (eyes closed,
 * a small z: empty screens) and `talk` (one hand lifted, saying a line). Never
 * on a question screen, with one exception: `talk` stands beside the speaking
 * task of a course test (spec 2026-10-28, RULES.md rule 9).
 *
 * Inline SVG in brand tokens only: a yellow body (the mark's tallest step) on a
 * cyan and a red step, ink face, red cheeks at 40%. Hidden from assistive
 * technology (the screen's title carries the meaning). Two motions, both
 * switched off under prefers-reduced-motion: a gentle pop on `celebrate`, and
 * the open mouth of `talk` while `talking` is set (a smile otherwise).
 */
export type MascotPose = "wave" | "celebrate" | "think" | "rest" | "talk";

export const MASCOT_POSES: readonly MascotPose[] = ["wave", "celebrate", "think", "rest", "talk"];

const SIZE = {
  hero: "w-full max-w-[260px]",
  spot: "w-[160px]",
  small: "w-24",
} as const;

/** A step with a flat lip under it: the lip is the same shape moved 5px down. */
function Step({ d, fill, lip }: { d: string; fill: string; lip: string }) {
  return (
    <>
      <path d={d} className={lip} transform="translate(0,5)" />
      <path d={d} className={fill} />
    </>
  );
}

const SMALL = "M42,140 H44 A16,16 0 0 1 60,156 V171 A9,9 0 0 1 51,180 H35 A9,9 0 0 1 26,171 V156 A16,16 0 0 1 42,140 Z";
const MIDDLE = "M79,116 H79 A17,17 0 0 1 96,133 V171 A9,9 0 0 1 87,180 H71 A9,9 0 0 1 62,171 V133 A17,17 0 0 1 79,116 Z";
const TALL = "M128,56 H130 A30,30 0 0 1 160,86 V166 A14,14 0 0 1 146,180 H112 A14,14 0 0 1 98,166 V86 A30,30 0 0 1 128,56 Z";

/** The two small steps every pose stands on; `stepUp` hides the arm that rests on them. */
function Steps({ stepUp = false }: { stepUp?: boolean }) {
  return (
    <>
      <Step d={SMALL} fill="fill-brand" lip="fill-brand-lip" />
      <Step d={MIDDLE} fill="fill-red" lip="fill-red-lip" />
      {stepUp ? null : <path d="M101 124 L88 140" strokeWidth="9" strokeLinecap="round" fill="none" className="stroke-yellow" />}
    </>
  );
}

/** The big step: the body every pose shares. */
function Body() {
  return <Step d={TALL} fill="fill-yellow" lip="fill-mascot-yellow-lip" />;
}

const cheeks = (y: number): ReactNode => (
  <>
    <circle cx="109" cy={y} r="5" className="fill-red opacity-40" />
    <circle cx="149" cy={y} r="5" className="fill-red opacity-40" />
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

const LINE = { strokeWidth: 3.5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none", className: "stroke-ink" } as const;
const ARM = { strokeWidth: 9, strokeLinecap: "round", fill: "none", className: "stroke-yellow" } as const;

/**
 * The mouth of the `talk` pose. At rest the smile of `wave`. While talking, an
 * open mouth that opens and closes about its own centre (the `mascot-talk`
 * keyframes in globals.css, motion-safe only like `pop-in`): under
 * prefers-reduced-motion it stays still, and the screen does not ask for it
 * then (it shows the whole line at once).
 */
function TalkMouth({ talking }: { talking: boolean }) {
  if (!talking) return <path d="M121 110 Q129 118 137 110" {...LINE} />;
  return (
    <g data-mouth="open" className="origin-center [transform-box:fill-box] motion-safe:animate-[mascot-talk_260ms_ease-in-out_infinite]">
      <ellipse cx="129" cy="115" rx="9.5" ry="8" className="fill-ink" />
      <ellipse cx="129" cy="119.5" rx="5" ry="2.8" className="fill-red opacity-70" />
    </g>
  );
}

/** One hand lifted to gesture, the face turned to whoever it speaks to. */
function talkPose(talking: boolean): ReactNode {
  return (
    <>
      <Steps />
      <Body />
      <path d="M156 118 Q176 114 176 98" {...ARM} />
      <circle cx="176" cy="93" r="7" className="fill-yellow" />
      <Eyes />
      {cheeks(110)}
      <TalkMouth talking={talking} />
    </>
  );
}

const POSES: Record<Exclude<MascotPose, "talk">, ReactNode> = {
  wave: (
    <>
      <Steps />
      <Body />
      <path d="M156 112 Q174 98 171 78" {...ARM} />
      <circle cx="171" cy="74" r="7" className="fill-yellow" />
      <Eyes />
      {cheeks(110)}
      <path d="M121 110 Q129 118 137 110" {...LINE} />
    </>
  ),
  celebrate: (
    <>
      <Steps stepUp />
      <Body />
      <path d="M102 112 Q86 96 88 76" {...ARM} />
      <circle cx="88" cy="72" r="7" className="fill-yellow" />
      <path d="M156 112 Q174 96 171 76" {...ARM} />
      <circle cx="171" cy="72" r="7" className="fill-yellow" />
      <path d="M110 93 Q117 85 124 93" {...LINE} />
      <path d="M134 93 Q141 85 148 93" {...LINE} />
      {cheeks(108)}
      <path d="M119 106 Q129 122 139 106 Z" className="fill-ink" />
      <ellipse cx="129" cy="113" rx="4.5" ry="2.6" className="fill-red opacity-70" />
      <circle cx="46" cy="44" r="4" className="fill-yellow" />
      <circle cx="170" cy="34" r="4" className="fill-red" />
      <circle cx="186" cy="84" r="3.5" className="fill-brand" />
    </>
  ),
  // One hand on the chin: the white edge keeps the hand readable against the body.
  think: (
    <>
      <Steps />
      <Body />
      <path d="M158 150 Q178 142 168 126 Q158 116 143 120" {...ARM} />
      <Eyes up />
      {cheeks(108)}
      <circle cx="140" cy="121" r="8" strokeWidth="2.5" className="fill-yellow stroke-white" />
      <path d="M118 112 Q124 109 130 112" {...LINE} />
      <circle cx="176" cy="48" r="5" className="fill-brand" />
      <circle cx="166" cy="30" r="3.4" className="fill-red" />
    </>
  ),
  rest: (
    <>
      <Steps />
      <Body />
      <path d="M110 92 Q117 99 124 92" {...LINE} />
      <path d="M134 92 Q141 99 148 92" {...LINE} />
      {cheeks(110)}
      <path d="M124 113 Q129 117 134 113" {...LINE} />
      <path d="M172 50 H184 L172 64 H184" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-mascot-sleep" />
      <path d="M160 28 H168 L160 38 H168" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" className="stroke-mascot-sleep" />
    </>
  ),
};

export function Mascot({
  pose,
  size = "spot",
  className,
  talking = false,
}: {
  pose: MascotPose;
  size?: keyof typeof SIZE;
  className?: string;
  /** `talk` only: the mouth moves while the line is being said, a smile once it is done. */
  talking?: boolean;
}) {
  const moving = pose === "talk" && talking;
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      data-pose={pose}
      data-talking={moving ? "true" : undefined}
      className={cn("h-auto shrink-0", SIZE[size], pose === "celebrate" && "motion-safe:animate-[pop-in_520ms_cubic-bezier(0.2,0.8,0.2,1)_both]", className)}
    >
      {pose === "talk" ? talkPose(moving) : POSES[pose]}
    </svg>
  );
}
