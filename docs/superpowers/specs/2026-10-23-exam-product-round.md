# Spec: exam product round (2026-10-23)

Source: owner feedback 2026-10-23, approved plan. This file is the binding spec for the round; rulings are logged in the plan ledger and summarized at the end of this file when the round closes.


## Özet (Türkçe)

- **Sınav ekranı:** saat ortada büyük hap içinde, 5 ve 2 dakika kala küçük sarı bildirim; "Flag" -> "Mark"
  (yer imi ikonu); başlıklar büyür (spec ölçeği 21-30px); ilan kartları renkli, düzgün kartlar; genel cila.
- **Yardım:** her bölümden önce Kademe ekranını birebir çizen, anlatıcı sesli 30-45 sn animasyon (5 dil);
  okuma/dinlemede vurgulama, altını çizme, kalem, silgi.
- **Sonuç:** öğrenciye soru değil analiz: bölüm bölüm doğru/yanlış/boş, "şu konulardan soruldu, bilemediniz";
  seviyeyi öğretmen her sonuçta gösterir ya da gizler.
- **Dil:** öğrenci varsayılanı English; panele Deutsch (Sie hitabı).
- **Banka:** seviye başına 3 form, kitaplardan yeni formatlar (resim eşleştirme, resimli seçmeli dinleme,
  4/8 işaretleme, Ja/Nein, Wer sagt was, metne paragraf yerleştirme, açık boşluk, Sprachbausteine 15,
  tablo doldurma, 3 sesli dinleme, tek dinleme, grafik yazma/konuşma), konuşma 1 resimli (internetten bulunur);
  aynı öğrenci tekrar girerse aynı soruları görmez.
- **Telegram:** 24 dosyanın hepsi zaten yerelde (boyutlar birebir); eksik olan TestDaF Musterprüfung 1-4 metni,
  OCR ile çıkarılacak.
- **Süre:** paralel ajanlarla yaklaşık 10-12 iş günü. Canlıya tek seferde, "canlıya al" deyince.

## Context

Owner feedback after using the live exam (main `8ea4bfe`): make Kademe feel like a real product. Owner answers
(2026-10-23): speaking task 1 picture-based with images found on the web via Claude in Chrome (licensing is the
owner's call; prefer Pexels/Unsplash/Wikimedia, keep source URLs in a manifest); how-to videos = narrated
animation drawing the Kademe screen 1:1; teacher chooses per result whether the level shows; 3 forms per level;
new formats from the books are a must; "Mark" rename on the candidate exam only; one production rollout at the end.

Facts that shape the plan: no image support anywhere; `exposureCount` never used (retakes repeat items); grammar
texts carry one generic tag (no per-gap topics) and tag spellings drift; only `candidate.en.json` says "Flag";
candidate locale default `tr` in 3 places + DB; panel tr/en only (~2500 strings, `Locale` shared with hiring and
`I18nText {tr,en}`); headings 12.5px while DESIGN.md defines title 21 / headline 30; proctoring logs `dragstart`
as COPY_ATTEMPT and modifier shortcuts as BLOCKED_SHORTCUT; `useChipDrag` uses `elementFromPoint`; prod storage is
the VM disk (~4 GB free); TTS is Gemini (`src/lib/tts.ts`, 2 voices max).

## Working model

- Branch `platform/solutions`. Spec first: `docs/superpowers/specs/2026-10-23-exam-product-round.md` with a
  ledger of rulings. Sonnet subagents implement with strict file ownership; Opus writes briefs and verifies each
  lane (diff, `npx tsc --noEmit`, vitest, Claude in Chrome). English code/comments/commits, no em dash anywhere.
- **One migration** `0026` owned by the engine lane: `stimuli.max_plays smallint null check 1..3`, index
  `candidates(org_id, lower(email))`, `assessments.locale default 'en'`, `exam_results.level_shown boolean null`.

## Wave 0 (day 0.5, lands first, merged alone)

1. Spec + shared types in `src/lib/exam/types.ts`: `ImageRef {storageKey, w, h, alt}`, TFNG `wording`, CHOICE
   `pick`, text kind `OPEN`, GAP key `topics`; `src/lib/exam/topics.ts` skeleton (`TOPICS`, `TAG_ALIASES`,
   `topicOf`, `topicLabel(tag, locale)`); `PassageBlock` shape (ad `letter`, `facts`, optional image).
2. ExamRunner split, no behavior change: `exam/ExamTopBar.tsx`, `ItemHeading.tsx`, `ReadingPane.tsx`,
   `SectionIntro.tsx`; `step-footer.tsx` gets `placement="contained"` and `measure={false}`.
3. Type tokens in `src/app/globals.css` `@theme` from DESIGN.md:65-155 (`--text-display` ... `--text-passage`),
   pinned in `theme.test.ts`.
4. Migration 0026 + `pnpm db:fingerprint`.
5. Start in background: tesseract `deu` data + OCR of TestDaF Musterprüfung 1-4 into `kademe-kaynaklar/text/`
   (never committed); image sourcing (see Part B).

## Part A: candidate UI (lane "UI", owns ExamRunner split files, ExamNav, notes/, tutorial/)

- **Timer:** `src/lib/exam/time-cue.ts` (+test) + `exam/TimerPill.tsx` centered in `ExamTopBar`: white pill,
  20px/900 tabular digits, clock icon. <=5 min (sections >10 min) and <=2 min: pill turns yellow-soft with ink
  text and one `Notice` (role=status, auto-hide 12 s, shown once per threshold via sessionStorage). Never red,
  never blinking. Update DESIGN.md:794 and EXPERIENCE.md:165,234.
- **Mark:** en copy Mark / Remove mark / Marked / Questions you marked (+ ruleBack, reviewAllDone,
  confirmFinishFlagged, flagSetHelp); filled lucide `Bookmark` instead of `Flag`; `FlagMark` -> `MarkBadge`,
  step-footer tone `flagged` -> `marked`. Keys, API (`/exam/answer/flag`) and DB names unchanged. Test: no "flag"
  in en examNav/cheatWarning values.
- **Headings:** question label `text-title` ink sentence case; reading title `text-title`; prompt `text-body-lg`
  700; passage 17px; section intro h1 `text-headline-lg`; review h1 `text-headline`; panel `panel-header.tsx` h1
  `text-headline` and the ~11 hand-sized page h1s onto it. Bottom bar and C-test sizes stay.
- **Note tools** (`exam/notes/`: NotesToolbar, NotesLayer, ScratchPad, notes-model, notes-store): highlight and
  underline via CSS Custom Highlight API (text offsets, selection cleared at once so no dragstart), pen on a
  DPR canvas with `pointer-events:none` unless pen/eraser active, eraser, clear with 8 s Undo. sessionStorage key
  per token + section + text hash, capped. Listening: highlight on stems + pen scratch pad under the player.
  Never over the answer column; hidden if the Highlight API is missing; import-graph test keeps it off the API.
- **How-to tutorials** (`exam/tutorial/`): in-app player rendering the REAL item components in an inert demo
  stage (no token, no-op onChange, ESLint + import-graph guard), scripted timeline (move, click, drag, type,
  spotlight, notes), fake cursor, captions, play/pause/seek/replay/skip. Narration per step via Gemini TTS
  (`synthesizeSpeech` exported from `tts.ts`, `scripts/tutorial-tts.ts`, hashed, mono 48 kbps mp3 under
  `public/tutorial/<locale>/<SECTION>/`), 6-8 steps, 30-45 s per section, 5 languages. Intro row: "Watch how it
  works (0:40)" next to warm-up "Try"; `suppressVoice`/`suppressWarnings("tutorial")` while open. MP4 rejected:
  manual recording of 25 files, re-record on every UI change, no RTL.
- **Polish:** error lines -> `Notice`, spec cards for RecoverPanel/ConfirmDialog, option cards, reading article
  card, recording dot.

## Part B: renderers, engine, bank (lanes "Items", "Engine", "TTS+Topics", "Images", 6 level authors)

- **Items lane** (owns `ItemView.tsx`, `MediaItems.tsx`, `TaskPromptCard.tsx`, `PassageBody.tsx`,
  `passage-blocks.ts`, `safe.ts`, `validate.ts`):
  - Ad cards: six soft tints only for ads (sky, mint, peach, lilac, butter, sand) via `src/lib/exam/ad-tone.ts`,
    letter disc, 17/900 title, fact lines with icons, two columns; tray letters take their ad's tint, letter
    always shown; "keine passt" as a grey card. Owner's color exception written into DESIGN.md + RULES.md.
  - Pictures: picture grid in ChoiceItem, lettered gallery in MatchingItem, picture above SpeakingItem /
    TaskPromptCard / WritingItem. `safe.ts` sends only `{slot, w, h, alt}`.
  - Ja/Nein labels (E2), "Kreuzen Sie 4 an" counter (E3), open cloze typed gaps (E4).
- **Engine lane** (owns `exam-flow.ts`, `blueprint.ts`, migration, routes, `bank-import.ts`):
  - Image route `src/app/api/c/[token]/exam/image/[sequence]/[slot]/route.ts` streams from storage for a served
    item of the current attempt (read Next route-handler docs in `node_modules/next/dist/docs/` first).
  - `bank-import.ts` uploads missing seed images before inserting rows; teacher bank page shows images; item
    editor/CSV keep or refuse picture items (`item-roundtrip.test.ts`).
  - Per-clip plays: `playsAllowed()` in `recordPlay`, `candidateItemFor`, `listening-audio`.
  - No repeats: `src/server/exam-exposure.ts` (items/stimuli served to same org + email); `avoid` in
    `sampleFixedForm`, `textOpenings`, `pickProductive` (moved into `blueprint.ts`); fresh first, then least
    exposed; empty `avoid` = today's draw. Speaking slot 1 prefers `speaking.picture`.
  - `src/lib/exam/forms.test.ts` (3 draws, zero overlap, 4th falls back), `scripts/form-timing.ts` to re-time
    template minutes.
  - `StudentResult.analysis` + `levelShown` (filled only after release) for Part C.
- **TTS+Topics lane** (owns `tts.ts`, `topics.ts`, `cloze.ts`/`wordbank.ts`/`ctest.ts`/new `opencloze.ts`,
  `student-feedback.ts`, `detail-model.ts`): voices C/D and chunked 3-4 voice clips (A/B unchanged so hashes
  hold); `#topic` per gap -> `key.topics`; aliases for drifted tags; grouping by topic with snapshot fallback.
- **Images lane** (Claude in Chrome, one agent): ~80 photos + ~12 generated SVG charts/slides,
  `src/db/seed-bank/images/*.webp` + `manifest.json` (id, sha, w, h, alt, sourceUrl, license, author),
  `scripts/bank-images.ts` (sharp devDependency). No text/logos that give answers away. Ids fixed before authors.
- **Format matrix:**

  | Level | Reading | Listening | Grammar | Writing / Speaking |
  |---|---|---|---|---|
  | A1 | signs -> pictures (1 spare); form fill | picture MC; short texts -> photos | | speaking picture |
  | A2 | headings; ads with "keine passt" | picture MC; tick 4 of 8 | | speaking picture |
  | B1 | Ja/Nein; "Wer sagt was" | table completion | Sprachbausteine 15 | picture; slide talk |
  | B2 | insertion 5/7; opinion matching | 3-voice "who says what"; play once | Sprachbausteine 15; open cloze | picture |
  | C1 | insertion; Ja/Nein/Text sagt nichts | table completion; 3 voices; once | open cloze | chart writing + speaking; picture |
  | C2 | paragraph insertion; opinion matching | 3 voices; once | open cloze | picture |

- **Targets per level (one draw x 3):** reading >=24 items in >=9 texts, listening >=21 items in >=8 clips,
  writing >=7, speaking >=4 picture + >=4 other, grammar texts 3 per kind (+3 Sprachbausteine B1-B2, +3 OPEN
  B2-C2), single grammar items retagged only.
- **Authoring per level:** one Sonnet author per `levels/xx.ts` (sole owner): tag every gap with `#topic`, then
  write new units per the matrix (original only, >=40% non-work topics, no origin/age/religion; picture tasks
  describe the picture in `rubric.contentPoints` for the AI grader). `scripts/bank-originality.ts` (8-word
  shingles vs `kademe-kaynaklar/text`, any hit blocks). Opus blind solve, two rounds (`bank-blind-export.ts` ->
  solve -> compare); fixes add new items and retire old ones. New `bank-quality.test.ts` rules: format quotas,
  topics resolve, images in manifest (webp, <=1600px), insertion has 2 spare targets, `pick` = key count,
  Ja/Nein from B1, NG from B2, play-once from B2, distinct voices for 3+ speakers. Then `pnpm bank:lock-listening`.
- **Deferred** (reported, not built): writing "pick 1 of 2", C2 "correct 5 wrong details", proofreading renderer.

## Part C: student analysis report (lane "Report", owns `Finished.tsx`, report/, release form)

- `src/lib/exam/student-analysis.ts`: per section right/wrong/blank in answer units; `missedTopics` from per-gap
  topic else item `skillTag`, labelled in the student's language; writing/speaking "assessed by your teacher";
  never item text, answers or keys. Loader `src/server/student-analysis.ts`.
- `Finished.tsx`: section rows (ink, never red/green), "Topics to practise" chips, approved feedback, level only
  when `levelShown`. Student print copy `/a/[token]/done/print` and panel `?copy=student` render
  `student-sheet.tsx` in the student's language; teacher keeps the question-by-question copy.
- Release form checkbox "Show the level to the student" (default from exam `resultVisibility`, changeable later
  with an audit row). Feedback draft in `actions.ts:425` uses `assessment.locale`. Update policy note
  `model.ts:11-16`.

## Part D: language defaults and German panel (lane "i18n", owns `src/i18n/*`, `format.ts`, lang-switch)

- English default: `DEFAULT_CANDIDATE_LOCALE = "en"`; `student-invite-wizard.tsx:146,757`,
  `students/new/actions.ts:80`, `src/i18n/candidate.ts:33`, `frame-context.tsx:29`, `path-steps.tsx:24`,
  `scripts/dev-link.ts`, seed (one tr student kept). Existing rows keep their language.
- German panel: `PANEL_LOCALES` tr/en/de + `PanelLocale` + `contentLocale()` (de -> en for DB content);
  `managerLocale()` returns `PanelLocale` and tsc lists every boundary; six `*.de.json` (glossary first,
  register Sie like `auth.de.json`/`candidate.de.json`); de-DE dates/numbers; ~38 hardcoded tr/en spots;
  TR/EN/DE switcher; de parity test in `messages.test.ts`. Translation pass runs last so it covers keys added by
  Parts A and C. Open: native German review (model-only so far).

## Order (elapsed, parallel)

| Days | Work |
|---|---|
| 0-0.5 | Wave 0 (types, ExamRunner split, tokens, migration); OCR and image sourcing start |
| 0.5-4 | UI: Mark, headings, timer; Items: ads, pictures, E2-E4; Engine: routes, plays, exposure, forms test; TTS+Topics; i18n: English default + German plumbing |
| 3-7 | 6 level authors in parallel, blind solve x2; UI: note tools; Report lane |
| 5-9 | Tutorial player + narration (needs stable renderers); German translation pass |
| 9-11 | Full verification, local rollout rehearsal on a `_check` DB, docs (STATUS, EXAM-ENGINE, DESIGN, RULES), memory |
| on "canlıya al" | Production rollout (below) |

## Verification

- Every lane: `npx tsc --noEmit`, `pnpm test` (rerun `templates.test.ts` alone if its known 5 s timeout trips),
  `pnpm lint`, `pnpm build`; `node scripts/css-decls.mjs` before/after tokens and ads; `pnpm db:fingerprint`.
- Engine: `forms.test.ts`, `blueprint.test.ts` unchanged draws, `scripts/simulate-placement.ts` gate,
  `scripts/form-timing.ts`, `pnpm verify:exam` (leak scan incl. image route, no `storageKey` in candidate JSON),
  `listening-lock.test.ts`, `bank-quality.test.ts`.
- Chrome (Claude in Chrome only, never Playwright): dev server
  `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm dev --port 3100`
  (`PROCTOR_DEV_FAKE=1` only in that shell, removed after); link via `pnpm dev:link`; same-origin iframe at
  1366x650. Screens: section intro + tutorial, timer at 5:00 and 2:00, Mark + review, ads, every new format,
  picture speaking, notes (highlight, pen, erase, undo, reload, drag while pen active), finish screen with level
  shown/hidden, student print copy; in en, de, ar. Panel in DE at 1366. Proctor log: no COPY_ATTEMPT or
  BLOCKED_SHORTCUT from notes or tutorial.
- Listen to all 25 narration tracks and a sample of new listening clips before calling them done.

## Production rollout (one time, after "canlıya al", no exam running)

`pg_dump` -> deploy script (migrate 0026, build) -> `bank:topup --production` without `--retire-stale`
(uploads images to the VM storage) -> `bank:tts` -> `--retire-stale --sync-seed` (ships topics) -> smoke test
`/login` + a dev link over HTTPS + grep served chunks for new strings -> log in `docs/STATUS.md`.
Check free disk first (~4 GB; images ~10 MB, new audio ~30-60 MB).

## Risks

- Prod migration is additive (nullable column, defaults, index); backup first.
- Gemini TTS quota: content-addressed, reruns are free; make prod audio once on the VM.
- Template timing shifts as items per section change: re-time with `form-timing.ts`.
- 160 files import `Locale`: keep `Locale` for content/hiring, add `PanelLocale` beside it.
- German strings may overflow panel layouts: check at 1366.
- New listening audio and German UI still lack a native human review (existing open item).
