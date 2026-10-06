// kademe-owned
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * HIRING-VISUAL-FLOW 2.2 (K1): flat, calm spot drawings, hand-written inline
 * SVG. No people, no faces, no photo, no text inside the drawing; only the
 * illustration tones; hidden from assistive technology (the screen's title
 * carries the meaning). They appear only on welcome, consent, permission,
 * finish, problem and empty screens, never on a question screen (G11).
 * Static: no animation (2.3).
 *
 * One grammar for all fifteen, taken from the approved mockup: a soft panel
 * (fill), one quiet circle behind (tint), objects with a warm body and a
 * 1.5 ink line, and only small sage or tint details (text bars, a dashed
 * trail, a highlighted part).
 */
export type IllustrationName =
  | "welcome"
  | "consent"
  | "permission"
  | "warmup"
  | "stage"
  | "done"
  | "expired"
  | "closed"
  | "otherTab"
  | "desktopOnly"
  | "inviteReady"
  | "emptyToday"
  | "emptyOpenings"
  | "emptyCandidates"
  | "emptyLibrary";

const LINE = "var(--color-illus-line)";
const FILL = "var(--color-illus-fill)";
const TINT = "var(--color-illus-tint)";
const SAGE = "var(--color-illus-sage)";
const WARM = "var(--color-illus-warm)";
const ink = { stroke: LINE, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** A line of "text" inside a drawing: a soft bar, never letters. */
const bar = { fill: "none", stroke: TINT, strokeWidth: 3, strokeLinecap: "round" } as const;
/** A dashed trail (a path walked, a plane's flight). */
const trail = { fill: "none", stroke: SAGE, strokeWidth: 1.5, strokeLinecap: "round", strokeDasharray: "3 6" } as const;
const soft = { fill: "none", stroke: SAGE, strokeWidth: 1.5, strokeLinecap: "round" } as const;

type Drawing = { width: number; height: number; body: ReactNode };

/** The soft panel every drawing sits on. */
function Panel({ width, height, radius }: { width: number; height: number; radius: number }) {
  return <rect width={width} height={height} rx={radius} fill={FILL} />;
}

const DRAWINGS: Record<IllustrationName, Drawing> = {
  // A desk with a laptop, a plant and a cup (mockup 3.1).
  welcome: {
    width: 400,
    height: 220,
    body: (
      <>
        <Panel width={400} height={220} radius={20} />
        <circle cx="306" cy="66" r="40" fill={TINT} />
        <path d="M0 178 C90 164 170 184 260 172 S370 162 400 170 V200 a20 20 0 0 1 -20 20 H20 a20 20 0 0 1 -20 -20 Z" fill={WARM} />
        <path d="M62 168 H338 M92 168 V206 M308 168 V206" fill="none" {...ink} />
        <rect x="140" y="82" width="120" height="80" rx="7" fill={WARM} {...ink} />
        <path d="M126 168 H274 L264 161 H136 Z" fill={WARM} {...ink} />
        <rect x="152" y="94" width="96" height="48" rx="4" fill={FILL} />
        <path d="M193 107 L210 118 L193 129 Z" fill={SAGE} />
        <path d="M154 152 H196 M204 152 H228" {...bar} />
        <path d="M88 168 L83 142 H109 L104 168 Z" fill={WARM} {...ink} />
        <path d="M96 142 C91 124 79 119 69 121 C74 134 84 139 96 142 Z" fill={SAGE} {...ink} />
        <path d="M96 142 C99 120 111 110 124 110 C122 128 112 138 96 142 Z" fill={TINT} {...ink} />
        <path d="M96 142 C94 126 96 114 101 104" fill="none" {...ink} />
        <path d="M286 142 H312 V162 a5 5 0 0 1 -5 5 H291 a5 5 0 0 1 -5 -5 Z" fill={WARM} {...ink} />
        <path d="M312 147 h5 a5 5 0 0 1 0 10 h-5" fill="none" {...ink} />
        <path d="M294 134 c-3 -5 3 -7 0 -12 M304 134 c-3 -5 3 -7 0 -12" {...soft} />
      </>
    ),
  },
  // A shield with a check (mockup 3.2).
  consent: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="126" cy="28" r="12" fill={TINT} />
        <path d="M80 20 L109 31 V55 C109 74 96 89 80 97 C64 89 51 74 51 55 V31 Z" fill={WARM} {...ink} />
        <path d="M80 28 L101 36 V55 C101 69 92 81 80 88 Z" fill={TINT} />
        <path d="M67 57 L76 66 L94 47" fill="none" {...ink} strokeWidth={2} />
        <path d="M30 86 h5 M32.5 83.5 v5 M130 80 h5 M132.5 77.5 v5" {...soft} />
      </>
    ),
  },
  // A browser window: the camera icon in the address bar is the highlighted part, the
  // pointer shows where to click (this drawing carries meaning, 2.2).
  permission: {
    width: 400,
    height: 220,
    body: (
      <>
        <Panel width={400} height={220} radius={20} />
        <circle cx="336" cy="44" r="30" fill={TINT} />
        <rect x="56" y="34" width="288" height="162" rx="10" fill={WARM} {...ink} />
        <path d="M56 72 H344" fill="none" {...ink} />
        <circle cx="76" cy="53" r="4" fill={TINT} />
        <circle cx="90" cy="53" r="4" fill={TINT} />
        <rect x="118" y="43" width="204" height="20" rx="10" fill={FILL} {...ink} />
        <path d="M168 53 H262" {...bar} />
        <circle cx="140" cy="53" r="19" {...soft} strokeDasharray="3 5" />
        <circle cx="140" cy="53" r="13" fill={SAGE} {...ink} />
        <rect x="132.5" y="48.5" width="10" height="9" rx="2" fill="none" {...ink} />
        <path d="M142.5 53 L147.5 49.5 V56.5 Z" fill="none" {...ink} />
        <path d="M152 66 V86 L157 81 L161 89 L165 87 L161 79 H168 Z" fill={WARM} {...ink} />
        <rect x="80" y="92" width="136" height="84" rx="6" fill={FILL} {...ink} />
        <rect x="132" y="124" width="24" height="18" rx="3" fill={SAGE} {...ink} />
        <path d="M156 133 L166 126 V140 Z" fill={SAGE} {...ink} />
        <path d="M236 106 H318 M236 122 H298 M236 138 H308" {...bar} />
        <rect x="236" y="160" width="6" height="10" rx="3" fill={SAGE} />
        <rect x="246" y="153" width="6" height="17" rx="3" fill={SAGE} />
        <rect x="256" y="157" width="6" height="13" rx="3" fill={SAGE} />
        <rect x="266" y="162" width="6" height="8" rx="3" fill={TINT} />
        <rect x="276" y="164" width="6" height="6" rx="3" fill={TINT} />
      </>
    ),
  },
  // A cup with steam: a calm start.
  warmup: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="122" cy="32" r="16" fill={TINT} />
        <ellipse cx="78" cy="98" rx="34" ry="5" fill={WARM} {...ink} />
        <path d="M58 54 H96 V84 a10 10 0 0 1 -10 10 H68 a10 10 0 0 1 -10 -10 Z" fill={WARM} {...ink} />
        <path d="M96 62 h6 a9 9 0 0 1 0 18 h-6" fill="none" {...ink} />
        <path d="M58 66 H96" {...bar} />
        <path d="M68 46 c-4 -6 4 -9 0 -16 M78 46 c-4 -6 4 -9 0 -16 M88 46 c-4 -6 4 -9 0 -16" {...soft} />
      </>
    ),
  },
  // A dashed path between two flags: the stage ahead.
  stage: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="38" cy="32" r="14" fill={TINT} />
        <path d="M0 90 C40 78 72 96 106 84 S148 72 160 76 V102 a18 18 0 0 1 -18 18 H18 a18 18 0 0 1 -18 -18 Z" fill={WARM} />
        <path d="M30 104 C56 100 62 88 84 84 S122 66 128 54" {...trail} />
        <path d="M30 104 V78" fill="none" {...ink} />
        <path d="M30 78 H48 L43 84 L48 90 H30 Z" fill={SAGE} {...ink} />
        <path d="M128 54 V26" fill="none" {...ink} />
        <path d="M128 26 H146 L141 32 L146 38 H128 Z" fill={TINT} {...ink} />
      </>
    ),
  },
  // An envelope with a check and a paper plane's trail (mockup 3.10).
  done: {
    width: 400,
    height: 150,
    body: (
      <>
        <Panel width={400} height={150} radius={20} />
        <circle cx="108" cy="44" r="24" fill={TINT} />
        <path d="M36 112 C80 90 124 82 170 86" {...trail} />
        <path d="M22 118 L58 101 L46 126 Z" fill={WARM} {...ink} />
        <path d="M58 101 L41 118" fill="none" {...ink} />
        <rect x="170" y="52" width="124" height="80" rx="8" fill={WARM} {...ink} />
        <path d="M170 61 L232 101 L294 61" fill="none" {...ink} />
        <rect x="188" y="30" width="88" height="46" rx="4" fill={WARM} {...ink} />
        <path d="M201 43 H254 M201 54 H236" {...bar} />
        <circle cx="294" cy="54" r="20" fill={SAGE} {...ink} />
        <path d="M285 54 L292 61 L304 47" fill="none" {...ink} strokeWidth={2} />
        <path d="M338 34 h5 M340.5 31.5 v5 M352 70 h5 M354.5 67.5 v5" {...soft} />
      </>
    ),
  },
  // An hourglass that has run out beside a calendar.
  expired: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="128" cy="28" r="14" fill={TINT} />
        <path d="M50 28 C50 46 62 52 64 60 C62 68 50 74 50 92 H78 C78 74 66 68 64 60 C66 52 78 46 78 28 Z" fill={WARM} {...ink} />
        <path d="M53 90 C55 79 73 79 75 90 Z" fill={SAGE} />
        <rect x="42" y="22" width="44" height="6" rx="3" fill={TINT} {...ink} />
        <rect x="42" y="92" width="44" height="6" rx="3" fill={TINT} {...ink} />
        <rect x="94" y="48" width="44" height="44" rx="6" fill={WARM} {...ink} />
        <path d="M94 60 V54 a6 6 0 0 1 6 -6 H132 a6 6 0 0 1 6 6 V60 Z" fill={TINT} {...ink} />
        <path d="M106 44 V52 M126 44 V52" fill="none" {...ink} />
        <rect x="102" y="67" width="7" height="7" rx="2" fill={TINT} />
        <rect x="113" y="67" width="7" height="7" rx="2" fill={TINT} />
        <rect x="124" y="67" width="7" height="7" rx="2" fill={TINT} />
        <rect x="102" y="78" width="7" height="7" rx="2" fill={TINT} />
        <rect x="113" y="78" width="7" height="7" rx="2" fill={SAGE} />
      </>
    ),
  },
  // A closed door with a blank sign.
  closed: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="128" cy="30" r="14" fill={TINT} />
        <path d="M0 98 C50 92 110 104 160 96 V102 a18 18 0 0 1 -18 18 H18 a18 18 0 0 1 -18 -18 Z" fill={WARM} />
        <path d="M50 100 V22 a4 4 0 0 1 4 -4 H106 a4 4 0 0 1 4 4 V100 Z" fill={TINT} {...ink} />
        <rect x="58" y="26" width="44" height="74" rx="2" fill={WARM} {...ink} />
        <rect x="66" y="66" width="28" height="24" rx="2" fill={FILL} />
        <path d="M72 44 L80 36 L88 44" fill="none" {...ink} />
        <rect x="68" y="44" width="24" height="12" rx="2" fill={SAGE} {...ink} />
        <circle cx="95" cy="62" r="2.5" fill={LINE} />
        <path d="M30 100 H130" fill="none" {...ink} />
      </>
    ),
  },
  // Two windows, one in front of the other.
  otherTab: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="130" cy="26" r="12" fill={TINT} />
        <rect x="22" y="22" width="84" height="60" rx="6" fill={WARM} {...ink} />
        <path d="M22 34 H106" fill="none" {...ink} />
        <circle cx="30" cy="28" r="2" fill={TINT} />
        <circle cx="37" cy="28" r="2" fill={TINT} />
        <path d="M32 48 H70" {...bar} />
        <rect x="54" y="42" width="84" height="60" rx="6" fill={WARM} {...ink} />
        <path d="M54 54 V48 a6 6 0 0 1 6 -6 H132 a6 6 0 0 1 6 6 V54 Z" fill={TINT} {...ink} />
        <path d="M66 68 H118 M66 80 H104" {...bar} />
        <circle cx="124" cy="88" r="5" fill={SAGE} />
      </>
    ),
  },
  // A phone, a dashed arrow, a laptop (mockup 3.0, at the 342 phone width).
  desktopOnly: {
    width: 342,
    height: 140,
    body: (
      <>
        <Panel width={342} height={140} radius={18} />
        <circle cx="278" cy="38" r="22" fill={TINT} />
        <path d="M0 112 C86 102 162 116 242 108 S326 102 342 106 V122 a18 18 0 0 1 -18 18 H18 a18 18 0 0 1 -18 -18 Z" fill={WARM} />
        <rect x="54" y="40" width="44" height="78" rx="8" fill={WARM} {...ink} />
        <path d="M70 47 h12" fill="none" {...ink} />
        <rect x="61" y="56" width="30" height="40" rx="3" fill={TINT} />
        <path d="M114 78 C142 60 168 60 190 72" {...trail} strokeWidth={1.75} strokeDasharray="4 6" />
        <path d="M184 64 L192 73 L181 77" fill="none" {...ink} />
        <rect x="206" y="44" width="96" height="62" rx="6" fill={WARM} {...ink} />
        <rect x="216" y="54" width="76" height="40" rx="3" fill={FILL} />
        <path d="M246 66 L259 74 L246 82 Z" fill={SAGE} />
        <path d="M194 112 H314 L306 106 H202 Z" fill={WARM} {...ink} />
      </>
    ),
  },
  // A link (two chain rings) and a paper plane: the invite is ready to send.
  inviteReady: {
    width: 96,
    height: 96,
    body: (
      <>
        <Panel width={96} height={96} radius={16} />
        <circle cx="26" cy="26" r="9" fill={TINT} />
        <rect x="16" y="54" width="32" height="14" rx="7" fill="none" {...ink} transform="rotate(-45 32 61)" />
        <rect x="34" y="36" width="32" height="14" rx="7" fill="none" {...ink} transform="rotate(-45 50 43)" />
        <path d="M58 24 L82 13 L75 35 L69 28 Z" fill={WARM} {...ink} />
        <path d="M82 13 L69 28" fill="none" {...ink} />
      </>
    ),
  },
  // A cup and a list where everything is done: nothing waits today.
  emptyToday: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="32" cy="32" r="14" fill={TINT} />
        <rect x="74" y="20" width="58" height="80" rx="6" fill={WARM} {...ink} />
        <rect x="91" y="15" width="24" height="10" rx="3" fill={TINT} {...ink} />
        <circle cx="88" cy="42" r="5" fill={SAGE} />
        <circle cx="88" cy="60" r="5" fill={SAGE} />
        <circle cx="88" cy="78" r="5" fill={SAGE} />
        <path d="M85.5 42 l2 2 l3.5 -3.5 M85.5 60 l2 2 l3.5 -3.5 M85.5 78 l2 2 l3.5 -3.5" fill="none" {...ink} strokeWidth={1.25} />
        <path d="M100 42 H120 M100 60 H116 M100 78 H120" {...bar} />
        <path d="M32 76 H56 V92 a8 8 0 0 1 -8 8 H40 a8 8 0 0 1 -8 -8 Z" fill={WARM} {...ink} />
        <path d="M56 81 h4 a6 6 0 0 1 0 12 h-4" fill="none" {...ink} />
        <path d="M40 68 c-3 -4 3 -6 0 -11 M48 68 c-3 -4 3 -6 0 -11" {...soft} />
        <path d="M18 100 H142" fill="none" {...ink} />
      </>
    ),
  },
  // A board with one blank pinned note: no openings yet.
  emptyOpenings: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="134" cy="26" r="13" fill={TINT} />
        <path d="M48 92 L42 106 M112 92 L118 106" fill="none" {...ink} />
        <rect x="30" y="20" width="100" height="72" rx="6" fill={WARM} {...ink} />
        <rect x="60" y="38" width="40" height="36" rx="2" fill={FILL} {...ink} transform="rotate(-5 80 56)" />
        <path d="M68 54 H90" {...bar} />
        <circle cx="80" cy="38" r="4.5" fill={SAGE} {...ink} />
      </>
    ),
  },
  // An open, empty box: no candidates yet.
  emptyCandidates: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="34" cy="30" r="14" fill={TINT} />
        <ellipse cx="80" cy="104" rx="42" ry="5" fill={TINT} />
        <path d="M44 58 L30 44 L66 32 L80 46 Z" fill={WARM} {...ink} />
        <path d="M116 58 L130 44 L94 32 L80 46 Z" fill={WARM} {...ink} />
        <path d="M44 58 L80 46 L116 58 L80 70 Z" fill={SAGE} {...ink} />
        <path d="M44 58 L80 70 V102 L44 90 Z" fill={WARM} {...ink} />
        <path d="M80 70 L116 58 V90 L80 102 Z" fill={TINT} {...ink} />
      </>
    ),
  },
  // A shelf with one book standing, one leaning and room for more.
  emptyLibrary: {
    width: 160,
    height: 120,
    body: (
      <>
        <Panel width={160} height={120} radius={18} />
        <circle cx="128" cy="30" r="14" fill={TINT} />
        <path d="M40 92 V102 M120 92 V102" fill="none" {...ink} />
        <rect x="38" y="48" width="12" height="38" rx="2" fill={SAGE} {...ink} />
        <rect x="54" y="52" width="11" height="34" rx="2" fill={WARM} {...ink} transform="rotate(14 65 86)" />
        <rect x="76" y="52" width="11" height="34" rx="2" {...soft} strokeDasharray="3 4" />
        <rect x="91" y="52" width="11" height="34" rx="2" {...soft} strokeDasharray="3 4" />
        <path d="M118 86 L116 73 H132 L130 86 Z" fill={WARM} {...ink} />
        <path d="M124 73 C121 65 114 62 109 64 C111 70 116 72 124 73 Z" fill={SAGE} {...ink} />
        <path d="M124 73 C126 63 131 58 137 58 C136 66 131 71 124 73 Z" fill={TINT} {...ink} />
        <rect x="24" y="86" width="112" height="6" rx="2" fill={WARM} {...ink} />
      </>
    ),
  },
};

export const ILLUSTRATION_NAMES = Object.keys(DRAWINGS) as IllustrationName[];

const SIZE = {
  hero: "w-full max-w-[400px] lg:max-w-[340px] xl:max-w-[400px]",
  spot: "w-[160px]",
  phone: "w-full max-w-[342px]",
  small: "w-24",
  // The guided flows' question region in the panel (manager mockup 3, 6).
  flow: "w-[200px] xl:w-[260px]",
} as const;

export function Illustration({ name, size = "spot", className }: { name: IllustrationName; size?: keyof typeof SIZE; className?: string }) {
  const drawing = DRAWINGS[name];
  return (
    <svg
      viewBox={`0 0 ${drawing.width} ${drawing.height}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("h-auto shrink-0", SIZE[size], className)}
    >
      {drawing.body}
    </svg>
  );
}
