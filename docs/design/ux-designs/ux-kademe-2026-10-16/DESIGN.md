---
title: Kademe DESIGN
name: Kademe
description: Visual identity of Kademe, a German placement and level-verification exam plus hiring tool, presented as a Campus German product. White ground with Campus German cool greys, ink text, big soft corners, a flat "lip" under everything pressable, brand cyan, yellow and red only as small accents, Nunito, one mascot built from the logo mark. Desktop only, light only.
status: final
created: 2026-10-16
updated: 2026-10-16
sources:
  - docs/design/RULES.md
  - docs/design/EXAM-UX.md
  - docs/design/HIRING-UX.md
  - src/app/globals.css
  - src/components/visual/mascot.tsx
  - src/components/visual/brand-mark.tsx
  - docs/design/ux-designs/ux-kademe-2026-10-16/.memlog.md
colors:
  # Roles are settled (memlog 2026-10-16): cyan = the action and "answered"; yellow = flag, warning and notice;
  # red = brand (mark, mascot, celebration), the recording dot and a small error frame, nothing else;
  # the Kolay/Orta/Zor tints are a teacher-only exception (see "Color psychology" in Brand & Style).
  # Neutral axis: this is nearly all of every screen.
  ink: '#1D2127'
  ink-2: '#3F454D'
  muted: '#5B6370'
  ground: '#FFFFFF'
  surface: '#FFFFFF'
  cream: '#F1F4F7'
  track: '#E6EAEF'
  rim: '#E1E5EA'
  lip: '#D3D9E0'
  edge: '#7D8590'
  # Brand cyan (Campus German #0BBFDF): the primary action and the "answered" state.
  primary: '#0BBFDF'
  on-primary: '#1D2127'
  primary-lip: '#0891AB'
  primary-deep: '#0B6F84'
  primary-soft: '#DFF5FA'
  primary-soft-lip: '#C5E9F1'
  # Brand yellow (#FDD31D): flag, warning glyph, the mascot's body. Its soft ground carries every notice
  # (warning counter, system-check and offline notices, the teacher's "Gözden geçir").
  yellow: '#FDD31D'
  on-yellow: '#1D2127'
  yellow-lip: '#D9AE00'
  yellow-soft: '#FFF2B8'
  yellow-soft-lip: '#F0DC7A'
  # Brand red (#FF3B3B): the mark's and mascot's middle step, confetti, the recording dot. Never a button, never text,
  # never under white text, never a result, level, timer or warning.
  red: '#FF3B3B'
  red-lip: '#D92B2B'
  # The one red that frames an error (field border, "!" glyph): red-lip by role, 4.85:1 on white. Messages stay ink.
  error: '#D92B2B'
  # Difficulty tints (Kolay, Orta, Zor), teacher panel only. Their own set, one step stronger than the state grounds,
  # so a Kolay chip never reads as "selected" (primary-soft) and an Orta chip never as a warning (yellow-soft).
  # Ink text on all three (11.86, 13.00, 11.20). Never on a candidate screen or the printed level report.
  diff-easy: '#A9E7F3'
  diff-easy-lip: '#79CCDF'
  diff-medium: '#FFE680'
  diff-medium-lip: '#EBC63C'
  diff-hard: '#FFCACA'
  diff-hard-lip: '#F2A0A0'
  # Illustration only.
  mascot-yellow-lip: '#E3B400'
  mascot-sleep: '#8A6F00'
  # Used at 60% opacity behind the proctor warning.
  scrim: '#1D2127'
typography:
  # Nunito everywhere (kept by user decision). German exam content uses the same face.
  display:
    fontFamily: Nunito
    fontSize: 42px
    fontWeight: '900'
    lineHeight: '1.05'
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Nunito
    fontSize: 34px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline:
    fontFamily: Nunito
    fontSize: 30px
    fontWeight: '900'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  title-lg:
    fontFamily: Nunito
    fontSize: 24px
    fontWeight: '900'
    lineHeight: '1.25'
  title:
    fontFamily: Nunito
    fontSize: 21px
    fontWeight: '900'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Nunito
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.5'
  body:
    fontFamily: Nunito
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1.5'
  label:
    fontFamily: Nunito
    fontSize: 15px
    fontWeight: '800'
    lineHeight: '1.3'
  label-sm:
    fontFamily: Nunito
    fontSize: 13px
    fontWeight: '800'
    lineHeight: '1.3'
  caption:
    fontFamily: Nunito
    fontSize: 13px
    fontWeight: '700'
    lineHeight: '1.4'
  overline:
    fontFamily: Nunito
    fontSize: 13px
    fontWeight: '900'
    lineHeight: '1.3'
    letterSpacing: 0.1em
  button:
    fontFamily: Nunito
    fontSize: 17px
    fontWeight: '900'
    lineHeight: '1'
  button-lg:
    fontFamily: Nunito
    fontSize: 20px
    fontWeight: '900'
    lineHeight: '1'
  numeral:
    fontFamily: Nunito
    fontSize: 18px
    fontWeight: '900'
    lineHeight: '1'
  exam-passage:
    fontFamily: Nunito
    fontSize: 17px
    fontWeight: '600'
    lineHeight: '2.1'
  exam-gap:
    fontFamily: Nunito
    fontSize: 16px
    fontWeight: '800'
    lineHeight: '1.7'
  exam-chip:
    fontFamily: Nunito
    fontSize: 15px
    fontWeight: '800'
    lineHeight: '1'
  wordmark:
    fontFamily: Nunito
    fontSize: 24px
    fontWeight: '900'
    lineHeight: '1.05'
    letterSpacing: -0.015em
  wordmark-sm:
    fontFamily: Nunito
    fontSize: 20px
    fontWeight: '900'
    lineHeight: '1.05'
    letterSpacing: -0.015em
  byline:
    fontFamily: Nunito
    fontSize: 13px
    fontWeight: '700'
    lineHeight: '1.1'
  byline-sm:
    fontFamily: Nunito
    fontSize: 11.5px
    fontWeight: '700'
    lineHeight: '1.1'
rounded:
  sm: 9px
  md: 13px
  lg: 16px
  xl: 18px
  2xl: 22px
  3xl: 30px
  4xl: 36px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '7': 28px
  '8': 32px
  '10': 40px
  '12': 48px
  bar-x: 28px
  welcome-x: 48px
  panel-main-x: 40px
  card-pad-y: 26px
  card-pad-x: 30px
  hero-pad-y: 34px
  hero-pad-x: 54px
  cell-gap: 12px
  top-bar: 68px
  progress-strip: 20px
  bottom-bar: 66px
  welcome-bar: 96px
  panel-nav: 248px
  exam-column: 920px
  welcome-card: 780px
  candidate-frame: 1000px
  manager-frame: 1360px
  signin-card: 460px
  review-column: 680px
  report-page: 210mm
  report-pad-x: 16mm
  report-pad-y: 14mm
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.on-primary}'
    border: '{colors.primary-lip}'
    lip: '{colors.primary-lip}'
    lip-depth: 4px
    radius: '{rounded.xl}'
    height: 52px
    padding-x: 26px
    typography: '{typography.button}'
  button-primary-lg:
    background: '{colors.primary}'
    foreground: '{colors.on-primary}'
    border: '{colors.primary-lip}'
    lip: '{colors.primary-lip}'
    lip-depth: 4px
    radius: '{rounded.2xl}'
    height: 62px
    padding-x: 44px
    typography: '{typography.button-lg}'
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.edge}'
    lip: '{colors.lip}'
    lip-depth: 4px
    radius: '{rounded.xl}'
    height: 52px
    padding-x: 26px
    typography: '{typography.button}'
  button-text:
    background: 'transparent'
    foreground: '{colors.primary-deep}'
    radius: '{rounded.xl}'
    height: 52px
    padding-x: 14px
    typography: '{typography.button}'
  button-disabled:
    background: '{colors.cream}'
    foreground: '{colors.muted}'
    border: '{colors.rim}'
    radius: '{rounded.xl}'
    height: 52px
  field:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.edge}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.xl}'
    height: 52px
    padding-x: 18px
    typography: '{typography.body-lg}'
  card:
    background: '{colors.surface}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 6px
    radius: '{rounded.3xl}'
    padding: '{spacing.card-pad-y} {spacing.card-pad-x}'
  card-hero:
    background: '{colors.surface}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 7px
    radius: '{rounded.4xl}'
    padding: '{spacing.hero-pad-y} {spacing.hero-pad-x}'
    width: '{spacing.welcome-card}'
  card-warning:
    background: '{colors.surface}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 9px
    radius: '{rounded.4xl}'
    width: 600px
  warning-icon-tile:
    background: '{colors.yellow}'
    foreground: '{colors.on-yellow}'
    border: '{colors.yellow-lip}'
    lip: '{colors.yellow-lip}'
    lip-depth: 4px
    radius: '{rounded.2xl}'
    size: 72px
  warning-counter:
    background: '{colors.yellow-soft}'
    foreground: '{colors.ink}'
    lip: '{colors.yellow-soft-lip}'
    lip-depth: 3px
    radius: '{rounded.full}'
    typography: '{typography.label}'
  scrim:
    background: '{colors.scrim}'
    opacity: 0.6
  chip-section:
    background: '{colors.cream}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
    height: 42px
    typography: '{typography.label}'
  answer-chip:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.rim}'
    border-bottom: '{colors.edge}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.lg}'
    height: 42px
    typography: '{typography.exam-chip}'
  gap-box-empty:
    background: '{colors.ground}'
    foreground: '{colors.ink}'
    border: '{colors.edge}'
    border-style: dashed
    radius: '{rounded.md}'
    height: 38px
    typography: '{typography.exam-gap}'
  gap-box-selected:
    background: '{colors.primary-soft}'
    foreground: '{colors.ink}'
    border: '{colors.primary-deep}'
    lip: '{colors.primary-deep}'
    lip-depth: 3px
    radius: '{rounded.md}'
    height: 38px
  gap-box-filled:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.ink-2}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.md}'
    height: 38px
  question-cell-empty:
    background: '{colors.surface}'
    foreground: '{colors.ink-2}'
    border: '{colors.edge}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.lg}'
    size: 48px
    typography: '{typography.numeral}'
  question-cell-answered:
    background: '{colors.primary}'
    foreground: '{colors.ink}'
    border: '{colors.primary-lip}'
    lip: '{colors.primary-lip}'
    lip-depth: 3px
    radius: '{rounded.lg}'
    size: 48px
    badge: 'ink disc with a white check'
  question-cell-partial:
    background: '{colors.primary-soft}'
    foreground: '{colors.ink}'
    border: '{colors.primary-deep}'
    lip: '{colors.primary-deep}'
    lip-depth: 3px
    radius: '{rounded.lg}'
    size: 48px
    badge: 'white disc with a half-filled circle'
  question-cell-flagged:
    background: '{colors.yellow}'
    foreground: '{colors.ink}'
    border: '{colors.yellow-lip}'
    lip: '{colors.yellow-lip}'
    lip-depth: 3px
    radius: '{rounded.lg}'
    size: 48px
    badge: 'ink disc with a yellow flag'
  question-cell-current:
    ring: '{colors.ink}'
    ring-width: 3px
    ring-offset: 3px
  # Teacher panel only. Glyph, count and word are fixed; the tint is the third, redundant signal.
  difficulty-easy:
    background: '{colors.diff-easy}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
    glyph: 'steps 1 of 3 (on bars ink, off bars ink at 30%)'
    typography: '{typography.label-sm}'
  difficulty-medium:
    background: '{colors.diff-medium}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
    glyph: 'steps 2 of 3'
    typography: '{typography.label-sm}'
  difficulty-hard:
    background: '{colors.diff-hard}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
    glyph: 'steps 3 of 3'
    typography: '{typography.label-sm}'
  difficulty-tile:
    radius: '{rounded.2xl}'
    lip-depth: 4px
    lip-easy: '{colors.diff-easy-lip}'
    lip-medium: '{colors.diff-medium-lip}'
    lip-hard: '{colors.diff-hard-lip}'
    selected-border: '{colors.ink}'
    selected-lip: '{colors.ink}'
    selected-badge: 'ink disc with a white check'
  timer-pill:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.full}'
    typography: '{typography.button}'
  record-indicator:
    dot: '{colors.red}'
    dot-halo: 'red at 15% opacity, 4px'
    foreground: '{colors.ink-2}'
    typography: '{typography.caption}'
  progress-segment:
    track: '{colors.track}'
    fill: '{colors.primary-deep}'
    height: 10px
    radius: '{rounded.full}'
  wizard-step-done:
    background: '{colors.cream}'
    foreground: '{colors.muted}'
    disc: '{colors.primary}'
    radius: '{rounded.full}'
  wizard-step-now:
    background: '{colors.ink}'
    foreground: '{colors.surface}'
    disc: '{colors.surface}'
    radius: '{rounded.full}'
  wizard-step-todo:
    background: '{colors.cream}'
    foreground: '{colors.muted}'
    disc-border: '{colors.edge}'
    radius: '{rounded.full}'
  option-card:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.2xl}'
    marker-border: '{colors.edge}'
  option-card-selected:
    background: '{colors.primary-soft}'
    foreground: '{colors.ink}'
    border: '{colors.primary-deep}'
    lip: '{colors.primary-deep}'
    lip-depth: 3px
    radius: '{rounded.2xl}'
  level-button:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.lg}'
    height: 44px
  level-button-selected:
    background: '{colors.primary}'
    foreground: '{colors.ink}'
    border: '{colors.primary-lip}'
    lip: '{colors.primary-lip}'
    lip-depth: 3px
    radius: '{rounded.lg}'
    height: 44px
  result-row:
    background: '{colors.surface}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.2xl}'
  section-status-done:
    background: '{colors.cream}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
    height: 30px
    glyph: 'check in primary-deep'
  section-status-running:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.primary-deep}'
    radius: '{rounded.full}'
    height: 30px
    glyph: 'cyan live dot'
  section-status-todo:
    background: '{colors.surface}'
    foreground: '{colors.muted}'
    border: '{colors.edge}'
    border-style: dashed
    radius: '{rounded.full}'
    height: 30px
  nav-item-active:
    background: '{colors.primary-soft}'
    foreground: '{colors.ink}'
    lip: '{colors.primary-soft-lip}'
    lip-depth: 3px
    icon: '{colors.primary-deep}'
    radius: '{rounded.full}'
    height: 48px
  brand-lockup:
    wordmark: '{typography.wordmark}'
    byline: '{typography.byline}'
    mark-size: 48px
  mascot:
    body: '{colors.yellow}'
    body-lip: '{colors.mascot-yellow-lip}'
    steps: '{colors.primary} and {colors.red}'
    face-ink: '{colors.ink}'
  brand-mark-ink:
    tray: 'white, 1.6px {colors.ink} outline, no lip'
    steps: '{colors.ink}, same three heights as the full-color mark, no lips'
    use: 'print, photocopies, anything under 24px'
  candidate-bar:
    background: '{colors.surface}'
    border-bottom: '{colors.rim}'
    height: '{spacing.top-bar}'
    padding-x: '{spacing.bar-x}'
    lockup: 'mark 38px, {typography.wordmark-sm}, {typography.byline-sm}'
  school-chip:
    background: '{colors.surface}'
    foreground: '{colors.ink-2}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 3px
    radius: '{rounded.full}'
    typography: '{typography.label-sm}'
  language-switch:
    background: '{colors.cream}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
    height: 36px
    typography: '{typography.label-sm}'
    active: 'white segment, 2px {colors.rim} border'
  notice-warn:
    background: '{colors.yellow-soft}'
    foreground: '{colors.ink}'
    border: '{colors.yellow-soft-lip}'
    radius: '{rounded.2xl}'
    glyph: '28px {colors.yellow} disc with an ink "!"'
    typography: '{typography.label}'
  notice-neutral:
    background: '{colors.cream}'
    foreground: '{colors.ink}'
    radius: '{rounded.2xl}'
    glyph: 'info circle in {colors.ink-2}'
    typography: '{typography.label}'
  review-badge:
    background: '{colors.yellow-soft}'
    foreground: '{colors.ink}'
    border: '{colors.yellow-soft-lip}'
    radius: '{rounded.full}'
    height: 30px
    glyph: 'eye'
    typography: '{typography.label-sm}'
  field-error:
    border: '{colors.error}'
    glyph: '{colors.error}'
    message: '{colors.ink}'
  level-badge:
    background: '{colors.cream}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
    typography: '{typography.label}'
  level-bar:
    segments: 6
    segment-height: 10px
    radius: '{rounded.full}'
    reached: '{colors.primary-deep}'
    ahead: '{colors.track}'
    reached-print: '{colors.ink}'
    ahead-print: 'transparent with a 1.5px {colors.ink-2} outline'
  undo-strip:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '{colors.rim}'
    lip: '{colors.lip}'
    lip-depth: 4px
    radius: '{rounded.full}'
    height: 56px
    action: 'text button (button-text look)'
---

## Brand & Style

Kademe is a German placement and level-verification exam, and a hiring tool. A school hands it to its students and candidates as "bir Campus German ürünü" (a Campus German product). The tone is a calm, slightly playful learning app that never forgets it is an exam: a white ground with Campus German cool greys, white cards with big soft corners, ink text, and a flat solid "lip" under everything you can press.

**Mockups.** The look was picked from three rendered directions. The picked one is [mockups/direction-sicak-yumusak.html](mockups/direction-sicak-yumusak.html) ("Sıcak Yumuşak"): the most spacious of the three and the one where the mascot is most present. The two not chosen were **Yaprak** (a leaf-corner shape language with an ink primary button) and **Sakin Kampüs** (dense, hairline, dark-cyan button with white text, a tiny mascot). Seven more mockups draw the surfaces the picked one did not (listed in EXPERIENCE.md, Key screens). Where a mockup disagrees with this file or with EXPERIENCE.md, **these two files (the spines) win.**

The brand arrives through the Campus German logo's three colors, used as small accents, never as floods. The user's rule: "çok da renk renk kokmasın" (it should not feel like a pile of colors). So the base is neutral (cream, white, ink). Cyan marks the primary action and the answered state, yellow marks flags, warnings and notices, and red is nearly absent: the brand mark and mascot, the recording dot and a small error frame. Difficulty is the one teacher-only exception (see Color psychology). Five exam sections never become five colors; they are an icon and a word on a neutral pill.

**The mark.** The Kademe mark is a white tray (corner radius about a third of its width, with a `{colors.lip}` lip) holding three ascending steps, each with its own darker lip. The Campus German petal glyph (three rounded petals: red, yellow, cyan) appears only inside the byline, at 15px. The full Campus German logo image is not placed in product UI [ASSUMPTION: the mockup shows it only on its brand sheet].

**Platform.** Light only: no dark theme exists and none is planned. Desktop Chrome and Edge only (phones get an explanation screen, see EXPERIENCE.md).

### Color psychology

Sally's color-placement review ([review-color-psychology.md](review-color-psychology.md), 2026-10-16; Sally is the BMAD UX designer persona) checked every color job against exam anxiety, Turkish school and cultural associations, and who sees which screen. The review mixes research findings, design convention and its own inferences, and says which is which. It was not user-tested. The product owner adopted the following (see the memlog, `.memlog.md`, the run's decision log; 2026-10-16):

- **The red rule.** Red is only for the brand (mark, mascot, celebration), the recording dot and a small error frame. Never a button, never a result, level, timer, proctor warning or score. Full wording: Colors.
- **Warnings and errors are yellow.** Proctor warnings are the "sarı kart" (you are warned, still in the game). Error boxes (system check, offline, action failure) are yellow-soft with ink text. They used to be red-soft with red text in the shipped app, and a camera that is not found is not the student's fault. Only a form field's own frame goes red.
- **Results and level are never red or yellow.** "Doğrulanamadı" is neutral for students and a yellow-soft "Gözden geçir" for teachers.
- **Kept as proposed:** cyan primary with ink text, yellow flag (never a red flag), dark-cyan progress that does not change as time runs down, the full-color mark and mascot plus a one-color ink mark for print and small sizes.

**Overridden by the user.** Sally recommended a neutral or single-hue difficulty chip and no red for "Zor". The user kept Kolay = cyan, Orta = yellow, Zor = red, always with the 1, 2 or 3 step glyph and the word. The override is reconciled with the red rule as a teacher-only exception, with these mitigations:

1. **Teacher panel only.** The invite step's tiles and the result rows. Difficulty is stripped from candidate data. It appears on no candidate screen and not on the printed level report.
2. **Soft tints, ink text, never a saturated fill.** The three tints (`diff-easy`, `diff-medium`, `diff-hard`) are pale, form their own set and sit one step stronger than the state grounds, so Kolay never reuses the "selected" cyan-soft ground and Orta never reads as the yellow-soft warning ground (finding 5 in Sally's review). The Zor tint is a pale pink, not the brand red.
3. **Hue is never the only signal.** Step glyph and word always; the meaning survives a black-and-white print or a color-blind reader.
4. **It is a setting, not a verdict.** The hint copy says what the setting does to the questions (EXPERIENCE.md, Zorluk selector); nothing in the copy calls a student easy or hard.

**Still open:** whether the chip sits on every student row or once in the invite's group header (Sally's question 3; see EXPERIENCE.md, Open items). The mockups keep it on every row.

### Mascot & Illustration

The mascot is "Canlı basamak" (the living step): the Kademe mark's tallest step brought to life. It is the only drawing in the product with a face. It is built from the mark: the same three ascending steps in the same order (cyan shortest, red middle, yellow tallest), each with a darker flat lip under it. The yellow step is the body and carries the face; the cyan and red steps are what it stands on.

- **Poses (four, no more).** `wave` (the welcome and invite front doors, meaning the entry screens a person lands on first; one arm up). `think` (a wizard step that asks a decision; hand on chin, pupils up, two small cyan and red dots). `celebrate` (a section or the exam finished; both arms up, arched happy eyes, open mouth, confetti dots in the three brand colors). `rest` (empty screens; eyes closed, a "z" in `{colors.mascot-sleep}`).
- **Where.** Allowed: the candidate welcome (hero, 300px, standing on the card's top edge), wizard decision steps (spot, 160px, peeking over the card's top-right corner), the section break (210px inside the banner), the finish screen (celebrate), empty screens (rest). **Never** on a question screen, never on the proctor warning, never inside tables or reports.
- **Voice.** It never speaks about right or wrong. Its few lines only say a section is finished and that you can continue when ready.
- **Color.** Brand colors and ink only. No section colors, no pastel families, no gradients. Confetti is the three brand colors and nothing else. The yellow body (and the yellow tallest step of the mark) is a memlog assumption that the user has not answered separately.
- **Motion.** One gentle pop-in (about 520ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`) on `celebrate`, switched off under reduced motion.
- **Decorative leaves.** On front doors only (entry screens such as sign-in and welcome), three large faint blobs in `{colors.cream}` (420, 300 and 200px; each rounded on three corners and square on one) sit behind the card. They are texture, never content, and are not used inside the exam or the panel.
- **Construction.** 200 x 200 viewBox. Cyan step 34 x 40 at (26,140), red step 34 x 64 at (62,116), yellow body 62 x 124 at (98,56) with a 30 top radius and a 14 bottom radius. Each shape is drawn twice: a lip copy offset 5 down in the lip color, then the face copy. Lip colors: cyan `{colors.primary-lip}`, red `{colors.red-lip}`, yellow `{colors.mascot-yellow-lip}`. No ground shadow (the mockup draws one, but it is fully transparent).
- **Face.** White eye ellipses 8 x 9 at (117,92) and (141,92); ink pupils r4 with a white glint r1.3; cheeks r5 in `{colors.red}` at 38% opacity; mouth and brows in `{colors.ink}`, 3.5 stroke, round caps. Arms are 9-wide round strokes in `{colors.yellow}` with a r7 hand.

## Colors

The palette is two layers: a warm neutral axis that carries 90% of every screen, and three brand accents with strict jobs. The roles are settled (memlog 2026-10-16); the reasoning is in [Color psychology](#color-psychology).

**The red rule.** Red appears in exactly three places: the Kademe mark and the mascot (and the celebration confetti), the recording dot, and a small error frame (a field's border and its `!` glyph; the message itself stays ink). Never a button fill, never text, never under white text, never a result, a level, a timer, a proctor warning or a score. The Zorluk tints in the teacher panel are the only other reddish hue, and they are a pale pink ground under ink text, not the brand red. In the teacher's answer review a wrong answer is an ink cross on cream and a right answer a cyan tick (owner decision 2026-10-16), never red.

**Where brand color may appear.** The primary button, answered and partial cells, the check box and selected states, the progress fill, the flag, the warning tile and counter, notices, the recording dot, the live dot in a section status, the Kademe mark, the mascot, the byline glyph, and (teacher panel only) the difficulty chips and tiles. Anywhere else is neutral. If a screen shows more than about three brand-colored things at once, remove some.

**Neutral axis**

- **Ink (`#1D2127`)** is all text, headings and button labels, and the strong mark of the current or selected thing (the current-cell ring, the active wizard step, a selected difficulty tile). It is also the Campus German logo's ink.
- **Ink 2 (`#3F454D`)** is body copy under a heading. **Muted (`#5B6370`)** is secondary text and hints: the quietest text allowed, still 5.5:1 on the ground.
- **Ground (`#FFFFFF`)** is the page: white, as on Campus German (owner, 2026-10-16: the earlier warm cream looked bad); the panel ground is a near-white `#F7F9FB`. **Surface (`#FFFFFF`)** is cards and bars. **Cream (`#F1F4F7`, a cool light grey; the name is kept)** is pills, neutral badges and the faint background leaves. **Track (`#E6EAEF`)** is the empty part of a progress bar.
- **Rim (`#E1E5EA`)** is card and chip borders; **Lip (`#D3D9E0`)** is the flat edge under cards and neutral buttons. Both are decoration, not boundaries. **Edge (`#7D8590`)** is the one boundary color for controls: the empty gap box, the empty question cell, the secondary button, fields. It is 3.75:1 on white and 3.51:1 on the ground, so it clears the 3:1 UI-component floor. Anything a person must find in order to press it uses Edge, never Rim.

**Cyan: the action color.** `{colors.primary}` (`#0BBFDF`, the logo cyan) fills the primary button, the answered cell and the check box, always with `{colors.on-primary}` ink text (7.34:1). White text on this cyan is forbidden (2.20:1). The cyan fill alone is only 2.20:1 against white, so the **2px `{colors.primary-lip}` border and lip are load-bearing**: they give the control its 3:1 boundary (3.72:1 on white). Never drop them. `{colors.primary-deep}` (`#0B6F84`) is the cyan that works as text or a line: links, the "Geri" text button, progress fill, selected-state borders, the focus ring and icons on soft grounds (5.80:1 on white). `{colors.primary-soft}` is the quiet selected ground (selected gap, selected option, active menu item, a verified level on screen). It is never a difficulty ground.

**Yellow: attention without alarm.** `{colors.yellow}` is the flag cell, the warning icon tile and the mascot's body. Text on yellow is always ink (11.17:1); white on yellow is 1.45:1 and never used. `{colors.yellow-soft}` is the ground of every notice: the warning counter, the offline strip, the system-check and action-failure boxes, and the teacher's "Gözden geçir" badge. The proctor warning is yellow on purpose: "sarı kart", you are warned and still in the game.

**Red: brand, record, error frame.** `{colors.red}` is a mascot and mark step and the recording dot (3.53:1 on white, a shape only, never text). `{colors.error}` (`#D92B2B`, 4.85:1 on white) is the field error border and its `!` glyph.

**Errors.** A field's own error: 2px `{colors.error}` border, a `!` glyph in `{colors.error}`, and the message in ink telling how to fix it. Every other failure (a camera that is not found, a dropped connection, a save that did not go through, an action that did not complete) is a `notice-warn`: yellow-soft ground, ink text, a `!` on a yellow disc, plus the next action. A failure of the platform or the device is never drawn as the student's mistake.

**Results and level.** Never red and never yellow on a candidate or printed surface. A level is ink on cream or ink on print; a verified level may add a cyan-soft ground and a check on screen. A student who is told "doğrulanamadı" sees a `notice-neutral` (cream ground, info glyph, ink text). A teacher sees the same outcome as the yellow-soft `review-badge` "Gözden geçir", because the teacher has something to do.

**Difficulty (teacher panel only).** Kolay, Orta and Zor use `{colors.diff-easy}`, `{colors.diff-medium}` and `{colors.diff-hard}` (cyan, yellow, pale pink), always with a 1, 2 or 3 step glyph and the word. The user chose this mapping against Sally's recommendation (see Color psychology). Color is never the only signal: a person who sees no hue still reads "Orta, two steps". The tints are separate from the state grounds on purpose: `{colors.primary-soft}` means selected or verified, `{colors.yellow-soft}` means notice, `diff-*` means difficulty and nothing else. Difficulty never appears on a candidate screen, in candidate data, or on the printed level report.

**Contrast table** (WCAG 2.x relative luminance, all recomputed for this file, the difficulty tints and the error red included; text needs 4.5, large text and UI 3.0)

| Foreground / background | Ratio | Used for | Verdict |
|---|---|---|---|
| `#1D2127` on `#FFFFFF` | 15.13 | Body text on the ground | pass |
| `#3F454D` on `#FFFFFF` | 9.68 | Body text on cards | pass |
| `#5B6370` on `#FFFFFF` | 5.52 | Secondary text on the ground | pass |
| `#5B6370` on `#FFFFFF` | 5.89 | Secondary text on cards | pass |
| `#5B6370` on `#F1F4F7` | 5.10 | Hints inside cream pills | pass |
| `#1D2127` on `#0BBFDF` | 7.34 | Primary button, answered cell | pass |
| `#1D2127` on `#FFFFFF` | 16.17 | Secondary button, timer | pass |
| `#1D2127` on `#F1F4F7` | 13.99 | Section pill, neutral badge | pass |
| `#3F454D` on `#F1F4F7` | 8.38 | Description inside a pill | pass |
| `#1D2127` on `#DFF5FA` | 14.30 | Partial cell, selected option, active menu | pass |
| `#1D2127` on `#FFF2B8` | 14.35 | Warning counter, notices, "Gözden geçir" | pass |
| `#1D2127` on `#A9E7F3` | 11.86 | Kolay chip and tile | pass |
| `#1D2127` on `#FFE680` | 13.00 | Orta chip and tile | pass |
| `#1D2127` on `#FFCACA` | 11.20 | Zor chip and tile | pass |
| `#1D2127` on `#FDD31D` | 11.17 | Warning glyph, flagged cell | pass |
| `#0B6F84` on `#FFFFFF` | 5.80 | "Geri" link, icons | pass |
| `#0B6F84` on `#DFF5FA` | 5.13 | Icon on a soft ground | pass |
| `#0B6F84` on `#FFFFFF` | 5.43 | Focus ring, current marks | pass |
| `#0B6F84` on `#E6EAEF` | 4.54 | Progress fill against its track | pass (UI 3:1) |
| `#7D8590` on `#FFFFFF` | 3.75 | Empty gap, empty cell, secondary button border | pass (UI 3:1) |
| `#7D8590` on `#FFFFFF` | 3.51 | Same, on the ground | pass (UI 3:1) |
| `#0891AB` on `#FFFFFF` | 3.72 | Primary button border and lip | pass (UI 3:1) |
| `#FF3B3B` on `#FFFFFF` | 3.53 | Recording dot (shape only) | pass (UI 3:1), never text |
| `#D92B2B` on `#FFFFFF` | 4.85 | Field error border and `!` glyph | pass (text and UI) |
| `#D92B2B` on `#FFFFFF` | 4.54 | Same, on the ground | pass (text and UI) |
| `#FFFFFF` on `#0BBFDF` | 2.20 | White label on cyan | **forbidden**, use ink: 7.34 |
| `#FFFFFF` on `#FF3B3B` | 3.53 | White label on red | **forbidden**: red is never a button |
| `#FFFFFF` on `#FDD31D` | 1.45 | White label on yellow | **forbidden**, ink on yellow |
| `#0BBFDF` on `#FFFFFF` | 2.20 | Cyan as text or thin line | **forbidden**, use `#0B6F84` |
| `#0891AB` on `#E6EAEF` | 2.91 | First-try progress fill | **rejected**, `#0B6F84` passes at 4.54 |

The difficulty off-bars (ink at 30% over the tint) are about 1.7:1 and carry no information on their own: the word and the lit bars do.

**Known soft spots.** Rim and Lip are 1.2 to 1.4:1 against the ground (decorative by design); the flagged cell's own border `#D9AE00` is 2.10:1 on white, so the flagged state is carried by the ink flag badge (16:1) and the label, not by the border. Selectable cards (option cards) must carry an Edge-colored marker so they are not found by Rim alone [ASSUMPTION: the mockup draws option cards with Rim and a lip only].

## Typography

**Nunito** (rounded terminals, latin and latin-ext for Turkish and German), weights 400 to 900, loaded once for the whole app. Everything is Nunito, including German exam content; there is no serif and no second family. The system fallback is `ui-rounded, system-ui, sans-serif`.

The voice is heavy and friendly: headings and button labels are 900, labels 800, running text 600. Tracking is slightly negative on large sizes (`-0.025em` at 42px, `-0.015em` on the wordmark) and widened to `0.1em` only on the uppercase `overline`.

- `display` 42px: the welcome heading ("Hoş geldiniz, Elif!"), one per screen.
- `headline-lg` 34px: the proctor warning title. `headline` 30px: panel page titles.
- `title-lg` 24px: the section-break message. `title` 21px: the question instruction, wizard questions and card headings (the mockup's 20 and 22px headings snap to 21).
- `body-lg` 18px: the welcome lead and the warning rule (the mockup's 17.5 and 18.5 snap to 18). `body` 15px: help text and descriptions.
- `label` 15px and `label-sm` 13px: menu items, pills, badges, table cells. `caption` 13px: notes, "Kaydedildi · 4 sn önce". `overline` 13px uppercase: small field labels ("PARÇALAR"); it must be set with the Turkish locale so `i` and `ı` capitalize correctly.
- `button` 17px and `button-lg` 20px; the timer pill also uses `button`. `numeral` 18px: question-cell numbers.
- Exam content: `exam-passage` 17px with a 2.1 line height (the tall leading is what gives gap boxes room), `exam-gap` 16px inside a gap box, `exam-chip` 15px on answer chips. These are the shipped sizes, kept by the owner on 2026-10-16 so a C-test fits the window (the picked mockup draws 23/20/18px; the spine wins).
- `wordmark` 24px (front doors, welcome) and `wordmark-sm` 20px (menu and bars; the mockup's 19 and 22 snap to 20). `byline` 13px; `byline-sm` 11.5px in the menu lockup only. Minimum size for any other text: 12px [ASSUMPTION].

Every countdown, score-like number, cell number and count uses tabular numerals so digits do not jump. German text carries `lang="de"` and `translate="no"`.

## Layout & Spacing

Base unit 4px; the scale is 4, 8, 12, 16, 20, 24, 28, 32, 40, 48. The mockup's odd gaps (6, 9, 10, 14, 18, 22) snap to the nearest step. Named tokens hold the recurring measures: bars use `{spacing.bar-x}` side padding (28), the welcome bar `{spacing.welcome-x}` (48), the panel's main area `{spacing.panel-main-x}` (40), panel cards `{spacing.card-pad-y}` by `{spacing.card-pad-x}` (26 by 30) and the welcome card `{spacing.hero-pad-y}` by `{spacing.hero-pad-x}` (34 by 54).

**Reference viewport 1366 x 768.** The first screens of every flow (sign-in, welcome, each system-check step, section intro, each wizard step) must fit this viewport without scrolling. One decision per screen; the candidate frame is `{spacing.candidate-frame}` wide and the manager frame `{spacing.manager-frame}`.

- **Exam screen** is a fixed three-band layout: a `{spacing.top-bar}` top bar, a `{spacing.progress-strip}` progress strip, a question column centered at `{spacing.exam-column}` (920), and a `{spacing.bottom-bar}` one-row bottom bar fixed to the window. At a real 1366x768 laptop (about 650px visible) that leaves about 500px for the question. Long reading texts and long writing fields scroll inside the column; the bars never move.
- **Welcome** is a `{spacing.welcome-bar}` top bar, a 780px card (`{spacing.welcome-card}`) with the mascot standing on its top edge, and the faint leaves behind.
- **Panel** is a `{spacing.panel-nav}` white side menu and a fluid main area up to the manager frame; wizard cards sit in the main area.
- **Question strip.** Cells are 48px with a `{spacing.cell-gap}` gap; chips and tiles keep 8 to 12 between neighbors. Related items sit 8 to 12 apart, separate groups 24 to 32.
- **Narrow windows.** Below 1024px wide the panel menu becomes a sheet and candidate screens go single column with a narrow-window strip (its text is in EXPERIENCE.md, Responsive & Platform). Phones and tablets never get these layouts (they get the explanation screen).
- **Real laptop height.** The picked mockup budgets the full 768px as viewport height, but a physical 1366 x 768 laptop leaves roughly 650px after browser chrome. The key-screen mocks are drawn to fit 650px and show a dashed line there; the picked mockup's welcome screen was not re-fitted (measurements in EXPERIENCE.md, Open items).

## Elevation & Depth

Depth is a flat solid **lip**: a hard offset shadow with zero blur, under everything pressable and under every card. It is the product's signature and replaces blurred shadows almost entirely.

- Lip depths: cards 6px (hero card 7px, warning card 9px); buttons, difficulty tiles 4px; chips, cells, gap boxes (filled and selected), option cards, level buttons, timer pill, result rows, menu active item and fields 3px.
- Lip color follows the surface: neutral things use `{colors.lip}`; the cyan button and answered cell use `{colors.primary-lip}`; yellow things `{colors.yellow-lip}`; the difficulty tiles use the lip of their tint (`{colors.diff-easy-lip}`, `{colors.diff-medium-lip}`, `{colors.diff-hard-lip}`); the difficulty chips in tables and rows have no lip.
- **Pressed**: the element moves down 3px and its lip collapses to about 1px, as if pushed into the page.
- **Hover**: no color change; the cursor and the lip are enough [ASSUMPTION: the mockup is static, it defines no hover state].
- **Disabled**: `{colors.cream}` fill, `{colors.muted}` text, no lip, and the reason is written next to the button, never in a tooltip [ASSUMPTION for the exact disabled values].
- **Focus**: a 3px `{colors.primary-deep}` ring with a 3px offset on anything focusable [ASSUMPTION: the color is the mockup's focus color; the width and offset are taken from its current-cell ring]. The current question cell keeps its 3px ink ring (offset 3px); when a current cell is also focused the focus ring sits 3px outside it [ASSUMPTION].
- Blurred shadow is allowed in exactly one place: the proctor warning card, `0 40px 70px -30px rgba(0,0,0,.6)` over a `{colors.scrim}` at 60% opacity. Sheets and menus in the panel use a soft blurred shadow only because they float [ASSUMPTION: the mockup draws none].
- No gradients. No inner shadows. No translucent glass except the scrim.

## Shapes

Big, round, friendly. The radius scale:

- `{rounded.sm}` 9: check boxes, the mark's tray.
- `{rounded.md}` 13: gap boxes.
- `{rounded.lg}` 16: question cells, answer chips, level buttons.
- `{rounded.xl}` 18: buttons, fields, need-tiles.
- `{rounded.2xl}` 22: large button, difficulty tiles, option cards, result rows, the warning glyph tile.
- `{rounded.3xl}` 30: cards, the reading passage.
- `{rounded.4xl}` 36: the welcome card and the warning card.
- `{rounded.full}`: every pill and status (section chips, difficulty chips, timer, menu items, step chips).

The mockup's 15 and 20px corners snap to `{rounded.lg}` and `{rounded.2xl}`. Rule of thumb: the bigger and the more a surface is a "stage" for a decision, the rounder it is. No corner is ever sharp. The only squared corner is the one on the decorative leaf blobs. Illustrations and imagery follow the container corner of the thing that holds them.

## Components

Visual specs only; behavior lives in EXPERIENCE.md. All sizes are for the 1366 reference.

### Controls and containers

- **Primary button.** `{colors.primary}` fill, `{colors.on-primary}` label, 2px `{colors.primary-lip}` border, 4px `{colors.primary-lip}` lip, `{rounded.xl}`, 52px high, `{typography.button}`, an optional 19px stroke icon after the label (an arrow for "continue"). The large variant is 62px, `{rounded.2xl}`, `{typography.button-lg}`, for "Başlayalım" and the warning's dismiss. **One per screen.** Red is never a button color.
- **Secondary button.** White, ink label, 2px `{colors.edge}` border, 4px `{colors.lip}` lip. **Text button.** No fill, `{colors.primary-deep}` label (the "Geri" back link). Disabled: see Elevation & Depth.
- **Field** (sign-in, invite, info form) [ASSUMPTION: derived, the mockup draws no field]. 52px, white, 2px `{colors.edge}` border, 3px `{colors.lip}` lip, `{rounded.xl}`. Focus swaps the border to `{colors.primary-deep}`. An error swaps it to `{colors.error}`, puts a `!` glyph in `{colors.error}` and shows the message in ink under the field (the message says how to fix it).
- **Card.** White, 2px `{colors.rim}` border, 6px `{colors.lip}` lip, `{rounded.3xl}`. Hero card (welcome) `{rounded.4xl}`, 7px lip. The reading passage is a card.
- **Icons.** 24 grid, 2.2 stroke, round caps and joins, `currentColor`, shown at 19px (22px in need-tiles, 38px in the warning tile). The product's current lucide icons at stroke 2.2 match this [ASSUMPTION]. Added for notices and states: info (circle with an i), eye, wifi-off, refresh, copy, phone, globe, x, help (circle with a question mark).

### Brand and the candidate bar

- **Brand lockup.** The Kademe mark (48px at the welcome, 38px in the panel menu, 32px in the exam bar) beside the wordmark; under it the byline: the 15px three-petal glyph then "bir Campus German ürünü" in `{typography.byline}` and `{colors.ink-2}`. In the menu the byline is `{typography.byline-sm}`. A one-color **ink mark** (`brand-mark-ink`: white tray with a 1.6px ink outline, three ink steps at the same heights, no lips) is used for print, photocopies and anything under 24px.
- **Candidate bar** (info, system check, section intro, section break). White, `{spacing.top-bar}` (68px), 2px `{colors.rim}` bottom border, `{spacing.bar-x}` side padding. Left: the Kademe lockup with a 38px mark, `{typography.wordmark-sm}` and the byline in `{typography.byline-sm}`. Right: the school chip, the language switch and, once the exam has started (section intro, section break), the record indicator. No timer: the clock is not running. The exam bar replaces it while a question is on screen. [ASSUMPTION: derived from the picked mockup's welcome bar; the mockup draws no other candidate bar]
- **School chip.** White pill, 2px Rim border, 3px lip, `{typography.label-sm}` in `{colors.ink-2}`. It names the school and carries no Campus German glyph.
- **Language switch.** A cream pill with two segments, "TR" and "EN", in `{typography.label-sm}`; the active segment is white with a 2px Rim border. [ASSUMPTION: the spine names a switch, the mockup draws none]

### Exam screen

- **Top bar (exam).** White, 68px, 2px `{colors.rim}` bottom border. Left: mark (32px), the word "Kademe" in `{typography.wordmark-sm}`, a divider, the section chip, "Soru 5 / 6" in `{colors.ink-2}`. Right: the record indicator and the timer pill. **No byline, no Campus German link.**
- **Section chip.** Cream pill, 42px, a 19px stroke icon in `{colors.ink-2}` and the section name in `{typography.label}`. Icons: "Aa" for Dilbilgisi, an open book for Okuma, headphones for Dinleme, a pen for Yazma, a microphone for Konuşma. Same cream pill for all five; no per-section color. In the exam top bar the current section chip carries one 11px cyan dot, the same for every section, as in the mockup. The memlog assumption that sections have no per-section dot is still open for the user to confirm.
- **Record indicator.** An 11px `{colors.red}` dot with a 4px halo at 15% and the sentence "Kamera, ses ve ekran kaydediliyor" in `{typography.caption}`. The dot is static or pulses softly; it is never alarming.
- **Timer pill.** White, 2px `{colors.rim}` border, 3px lip, `{rounded.full}`, a 19px clock icon and tabular digits ("28:31"). It does not blink and does not turn red.
- **Progress strip.** One segment per section, 10px tall, 8 apart, `{colors.track}` track and `{colors.primary-deep}` fill; the finished sections are full, the current one partial.
- **Question cell.** 48px, `{rounded.lg}`, numeral in `{typography.numeral}`. Four states, each with a corner badge (21px disc, top-right) so no state is color-only: empty (white, Edge border, no badge), answered (cyan fill, ink disc with a white check), partial (cyan-soft fill, deep-cyan border, white disc with a half circle), flagged (yellow fill, ink disc with a yellow flag). The current cell gets a 3px ink ring at 3px offset.
- **Bottom bar.** White, about 66px (owner decision 2026-10-16: the shipped one-row bar, buttons 44px high), 2px `{colors.rim}` top border, one row: the cell strip on the left; on the right "İşaretle" (secondary, with a flag icon) and "Sonraki" (primary, with an arrow). The back control is a text button before the strip [ASSUMPTION: the mockup omits it; the shipped exam has "Önceki"]. On the last item the primary reads "Gözden geçir ve bitir".
- **Answer chip.** White, 2px Rim border with an Edge bottom border, 3px lip, `{rounded.lg}`, 42px, `{typography.exam-chip}`, German `lang="de"`. Lifted while dragged.
- **Gap box.** Empty: ground fill, dashed Edge border, `{rounded.md}`, 38px, a width equal for every gap of the item. Selected: cyan-soft fill, 2.5px deep-cyan border. Filled: white, solid ink-2 border, 3px lip, the placed part in `{typography.exam-gap}`.

### Candidate screens

- **Sign-in.** The lockup (48px mark, `{typography.wordmark}`, `{typography.byline}`) centered above one card of `{spacing.signin-card}` width: `{typography.headline}` title, a `{typography.body}` lead, one field with its label, the full-width primary. A caption under the card points a student who landed there back to the school's link. Faint cream leaves, no mascot. [ASSUMPTION: derived, the mockup draws no sign-in]
- **System check step.** Four step chips in a row ("1 Kamera ve mikrofon", "2 Sizi görüyoruz", "3 Ekranınızı paylaşın", "4 Hazırsınız"; the wizard step chip look, done = cyan disc and check) above one card of `{spacing.welcome-card}` width that holds one decision. No mascot. [ASSUMPTION: derived, the mockup draws no system check]
  - The card, top to bottom: `{typography.headline}` title, `{typography.body-lg}` lead, the visual of the step (for screen share: three option-card-style tiles "Tüm ekran", "Pencere", "Sekme", the right one marked), then the step footer (back text button left, the one primary right). "Sorun bildir" is a text button under the card.
  - A failed step puts a `notice-warn` between the visual and the footer. The primary becomes the retry; "Nasıl düzeltirim?" and "Sorun bildir" are text buttons.
- **Section intro card.** Hero-card style (`{spacing.welcome-card}`), no mascot. [ASSUMPTION: derived]
  - Top: the overline "BÖLÜM 3 / 5", then the section name in `{typography.headline-lg}` after a 56px cream icon tile, with the facts (time, items, plays) as neutral section-chip pills on the same line.
  - Middle: the rules as a short list, then the unscored warm-up offer as a cream block with a secondary "Dene" and a text "Geç".
  - Bottom: the large primary "Bölümü başlat" with the clock sentence next to it.
- **Review screen.** Inside the exam frame (top bar, progress strip, bottom bar), one column of `{spacing.review-column}`. [ASSUMPTION: derived from the shipped ReviewScreen structure]
  - Top to bottom: `{typography.headline}` title; `{typography.body-lg}` lead with the counts; one row per group (flagged, empty, partial) with the heading and its count on the left, jump buttons on the right and dashed dividers between rows; then a `notice-neutral` with the "you cannot come back" sentence.
  - The jump buttons are answer-chip-like and carry the same corner badges as the cells.
  - The bottom bar holds the cell strip (no current ring) on the left, a secondary "Sorulara dön" and the primary "Bölümü bitir" on the right.
- **Section break banner.** A white rounded card with the 210px mascot (celebrate) on the left; the overline "BÖLÜM ARASI", one `{typography.title-lg}` sentence, five progress segments with "1 / 5 bölüm tamamlandı", and the primary "Sıradaki bölüm".

### Notices, warnings and states

- **Notice.** `notice-warn` is yellow-soft with a 2px yellow-soft-lip border, `{rounded.2xl}`, a 28px yellow disc with an ink `!`, an ink `{typography.label}` lead and an ink `{typography.body}` line saying what to do next. It is used for system-check problems, action failures, AI-unavailable and, as a full-width strip with no visible corners under the bar, for the offline state. `notice-neutral` is cream, no border, an info glyph in `{colors.ink-2}`, ink text: for information that is not a problem (the student's "doğrulanamadı", "you cannot come back"). Neither is ever red.
- **Proctor warning card.** 600px, `{rounded.4xl}`, 9px lip, over the scrim. Big and calm, with no red. Top to bottom:
  - a 72px yellow tile with an ink `!` glyph;
  - the overline "UYARI" in a yellow-soft pill;
  - the title in `{typography.headline-lg}`;
  - the rule in `{typography.body-lg}`;
  - a line "Bu an kaydedildi ve öğretmeninize bildirildi." with a camera glyph;
  - the counter pill "Bu sınavdaki 1. uyarınız";
  - a dashed divider and "Süre işlemeye devam ediyor. Kalan süre: 28:31";
  - one full-width large primary button.
- **Recover panel.** The proctor warning's card (600px, 9px lip, over the scrim) with the lost device's icon in the 72px yellow tile, no overline and no counter: the title ("Ekran paylaşımı durdu"), one rule sentence, the clock sentence and one large primary that names the repair ("Paylaşımı yeniden başlat"). [ASSUMPTION]
- **State card, filter chip, skeleton.** A state card (time up, link not yet open, terminated, desktop only) is a white card with a centered 56px cream icon tile, a `{typography.title-lg}` title, a `{typography.body}` line and `{typography.caption}` notes; no mascot, no color beyond neutral. A removable filter chip is a cream pill, 36px, with a 16px x. A skeleton is `{colors.track}` bars on a white card, still (no shimmer). [ASSUMPTION: derived]

### Teacher panel and report

- **Menu item (panel).** 48px full pill; active = cyan-soft fill, 3px soft lip, deep-cyan icon, ink label.
- **Wizard step chips.** A row of pills "1 Öğrenciler", "2 Sınav ve zorluk", "3 Son bir bakış": done = cream pill with a cyan disc and check; now = ink pill with white text and a white disc; upcoming = cream pill with an Edge-bordered disc.
- **Option card** (invite: "Yerleştirme sınavı" / "Seviye doğrulama"). White, Rim border, 3px lip, `{rounded.2xl}`, bold title, muted hint; selected = cyan-soft ground, deep-cyan border and lip. **Level buttons** (A1 to C1): 44px squares, selected = the primary look.
- **Difficulty chip and tile** (teacher panel only). The chip is a pill: a 19 x 15 step glyph (three rounded bars of 6 x 7, 6 x 12 and 6 x 16; "on" bars ink, "off" bars ink at 30%) then the word in `{typography.label-sm}`, on its tint, no border, no lip. The tile (invite step) is `{rounded.2xl}`, shows the big glyph (32 x 26), the word, a hint of at most two lines and, when selected, a 2px ink border, ink lip and an ink check disc. Kolay: one bar on, `{colors.diff-easy}`. Orta: two bars, `{colors.diff-medium}`. Zor: three bars, `{colors.diff-hard}`. The hints say what the setting does ("Bir seviye aşağıdan", "Beyan edilen seviyeden", "Bir seviye yukarıdan"), never what the student is. The tints are not the selected or notice grounds (see Colors).
- **Result row.** A separate white rounded row per student: initials disc (cream), name and e-mail, the difficulty chip, the five section status badges, a status sentence, the level badge (cream pill, "B1"). A result the teacher must look at (for example a declared level that did not verify) shows the yellow-soft `review-badge` "Gözden geçir" and the sentence in place of the level badge. Section status badge: done = cream pill with a deep-cyan check; running = white pill with a deep-cyan border and a cyan live dot; waiting = white pill with a dashed Edge border and muted text. A key line explains the three.
- **Review badge.** Teacher only. A yellow-soft pill, 30px, 2px yellow-soft-lip border, an eye glyph and "Gözden geçir" in `{typography.label-sm}`. It marks a result that needs the teacher's look; it is a status, not a verdict, and sits in the status cell, never in the difficulty slot.
- **Level badge and level bar.** The badge is a cream pill with the level in `{typography.label}`, tabular ("B1"); a verified level on screen may sit on `{colors.primary-soft}` with a check. The bar has six segments (A1 to C2), 10px, `{rounded.full}`: reached segments `{colors.primary-deep}` on screen and `{colors.ink}` in print, the rest `{colors.track}` on screen and an outlined empty segment in print; the level letter ends the row. [ASSUMPTION: the shipped result and report already draw a six-segment bar in the old accent color; these colors are new]
- **Undo strip.** A white pill floating at the bottom center of the panel's main area: 56px, 2px Rim border, 4px lip, a soft blurred shadow because it floats, a `{typography.label}` sentence ("12 davet oluşturuldu.") and a deep-cyan text button "Geri al". It goes away by itself after 8 seconds. [ASSUMPTION: the spine fixes the 8 seconds and the label, the mockup draws no strip]
- **Printed level report.** A4 (`{spacing.report-page}` wide, padding `{spacing.report-pad-x}` by `{spacing.report-pad-y}`), one page of summary and an optional detail sheet after it. White paper, ink text, no lips, no cream ground, no difficulty (it is not printed), color optional: every fact survives a black-and-white print. Top to bottom:
  - Header: the one-color ink mark, the school's name in `{typography.title-lg}` and, on the right, the overline "SEVİYE RAPORU" with the date.
  - The student's name in `{typography.headline-lg}` with the exam and its date.
  - Result block, a 2px ink outlined box: the overline "GENEL SEVİYE" and the level as an 84px 900 numeral on the left, the one sentence for that level on the right. For a verification exam, an outcome row under a rule: a filled ink disc with a check and "Beyan edilen seviye doğrulandı", or an outlined disc with an info glyph and "Beyan edilen seviye bu sınavda doğrulanamadı", plus the declared and shown levels. Never red or yellow.
  - The per-skill list with the print level bar and the level letter.
  - The approving teacher, approval date and the "Doğrulama kodu".
  - One footer line with the three-petal glyph: "Bu rapor, Campus German'ın Kademe platformuyla hazırlandı." The school's own name stays the school's. [ASSUMPTION for the outcome line: the shipped report prints the level only]

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep the base neutral: cream ground, white cards, ink text | Flood a screen with cyan, yellow or red |
| Keep red to the brand mark and mascot, the recording dot and a small field-error frame | Use red for a button, a result, a level, a timer, a warning or a score |
| Draw platform and device failures as a yellow-soft notice with ink text and the next action | Show a red box for a camera that is not found, or word any failure as the student's mistake |
| Show "doğrulanamadı" as a neutral cream note to a student and as "Gözden geçir" to a teacher | Color a level or an outcome red or yellow where a student or a parent can see it |
| Use cyan fill with **ink** text for the one primary action | Put white text on cyan, red or yellow |
| Keep the primary button's `{colors.primary-lip}` border and lip | Drop the border and leave a 2.2:1 cyan blob on white |
| In the teacher panel only, show Kolay, Orta, Zor with a 1, 2 or 3 step glyph and the word on the `diff-*` tints | Rely on hue alone for any state; show difficulty to a student or on the printed report; reuse `primary-soft` or `yellow-soft` as a difficulty ground |
| Give every question-cell state a badge shape (check, half circle, flag) | Mark answered or flagged by fill color only |
| Keep the five sections neutral: cream pill, icon, word | Give each section its own color or a colored dot |
| Use Edge `{colors.edge}` for any boundary a person must find | Use Rim or Lip as the only outline of a control |
| Put the flat lip under cards and pressables; a press moves them down 3px | Add blurred shadows, gradients or glass (except the warning card) |
| Use big round corners from the ladder; pills for status | Use sharp corners or arbitrary radii |
| Make the proctor warning big and centered, with a yellow glyph, an ink title and a large cyan dismiss button | Make it red, small or a toast, or let Escape dismiss it |
| Draw the mascot only from the mark's three steps, in the four poses | Add a fifth pose, a second character, gradients or section colors |
| Keep the mascot off question screens, warnings, tables and reports | Let the mascot comment on right or wrong |
| Use the byline on front doors, the menu and printed reports | Put the byline on the running exam's bar, or any campusgerman.com link on a candidate screen |
| Use tabular numerals on timers, counts and cell numbers | Let digits jump while a clock runs |
| Set German content `lang="de" translate="no"` | Translate or restyle exam content per locale |
| Keep light only | Add a dark theme or a `dark:` look |
