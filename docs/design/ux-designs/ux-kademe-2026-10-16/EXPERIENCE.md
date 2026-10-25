---
title: Kademe EXPERIENCE
name: Kademe
status: final
created: 2026-10-16
updated: 2026-10-16
sources:
  - docs/design/RULES.md
  - docs/design/EXAM-UX.md
  - docs/design/HIRING-UX.md
  - src/app/globals.css
  - src/components/candidate/exam/ExamNav.tsx
  - src/components/candidate/exam/ItemView.tsx
  - src/components/candidate/proctor/CheatWarning.tsx
  - src/components/visual/step-footer.tsx
  - docs/design/ux-designs/ux-kademe-2026-10-16/.memlog.md
---

# Kademe: Experience Spine

> Paired with `DESIGN.md` (the visual identity). This redesign changes how Kademe looks and how brand shows up; it does **not** change the exam's rules, scoring or proctoring behavior. Anything not grounded in the repo docs, the shipped code or the run's memlog (`.memlog.md`, the decision log) is tagged `[ASSUMPTION]`. Names in the flows are illustrative.
>
> Mockups in `mockups/` show the picked direction and seven key screens (see Key screens). Where a mockup disagrees with this file or with `DESIGN.md`, **these two files (the spines) win.**

## Foundation

Desktop web app, Chrome and Edge only. Next.js with shadcn/ui (style radix-nova) plus Kademe-owned primitives (`Button`, `Card`, `StepFooter`, `Mascot`, `BrandMark`; files that begin `// kademe-owned`). `DESIGN.md` is the visual reference; tokens are written once, in `src/app/globals.css`, and the redesign moves that file from the green "soft" palette to the tokens in `DESIGN.md`. This repo's Next.js has breaking changes: read the guide in `node_modules/next/dist/docs/` before writing implementation code.

Three audiences, one product:

- **Students** sit an exam or a placement test, on a school's invite link. No account. UI Turkish or English; exam content German; addressed with **"siz"**.
- **Teachers and school managers** use the panel to invite, review AI proposals and decide. Addressed with **"sen"** in new copy (the shipped invite and bank screens already say "seç", "böl", "yaz").
- **Hiring candidates and hiring owners** use the hiring wizard and the candidate flow. Addressed with **"sen"**.

Kademe is presented as "bir Campus German ürünü" (English: "a Campus German product"). No dark theme. Time is server-authoritative. Phones and tablets get an explanation screen, never the flow.

**Binding product rules** (these outrank any visual choice):

1. The student never sees right or wrong, or a score, while answering. No cell, chip, color or sentence judges an answer. The warm-up is unscored.
2. The mascot is never on a question screen, never on the proctor warning.
3. A proctor warning is big, shows a per-attempt counter and never fails or ends the exam by itself. Termination rules exist only as a school-configured setting (default off) and appear later as a neutral sentence.
4. AI only proposes; a teacher decides. Nothing from AI is shown as a final level.
5. One filled (primary) button per screen. A disabled button states its reason beside it, never in a tooltip.
6. First screens fit 1366 x 768 without scrolling. One decision per screen. Wizard first; put the choice where the action happens (the "Zorluk" choice lives on the invite step, not in a hidden settings tab).
7. In the panel, undo beats "are you sure": the action happens and an 8-second undo strip appears. In the exam, steps that cannot be undone (skipping a question, finishing a section) ask once, in-app.
8. No dead ends: every empty list, zero result and finished flow points at a concrete next action.
9. **Brand color is a small accent.** The five sections never become five colors.
   - **The red rule:** red is only the brand (mark, mascot, celebration), the recording dot and a small field-error frame; never a button, a result, a level, a timer, a warning or a score. Proctor warnings and platform or device failures are yellow, never red.
   - **The one exception is Zorluk,** in the teacher panel only: Kolay, Orta, Zor on soft cyan, yellow and pale pink tints with ink text, always with the step glyph and the word; never on a candidate screen, in candidate data or on the printed level report.

## Information Architecture

| # | Surface | Route | Reached from | Purpose | Covered by |
|---|---|---|---|---|---|
| 1 | Panel sign-in | `/login` | Panel URL | Teacher or manager enters (panel password, or e-mail and password) | Flow 2 |
| 2 | Invite setup for a new panel user | `/setup/[token]` | Invite link | Set a password | spine-only |
| 3 | Candidate welcome and consent (exam) | `/a/[token]` | Invite link | What happens, what is recorded, consent | Flow 1 |
| 4 | Candidate info form | `/a/[token]/info` | Welcome | Name and contact, prefilled | Flow 1 |
| 5 | System check, four steps (camera and mic, "Sizi görüyoruz", screen share, "Hazırsınız") | `/a/[token]/check` | Info | Prove devices; end with the "Başlamadan önce" checklist (close every other app and tab, what is recorded, the rules) and its tick, then "Tam ekrana geç ve sınavı başlat" | Flow 1 |
| 6 | Desktop-only screen | same URLs on a phone | Any candidate link | Explain, copy the link | spine-only (State Patterns) |
| 7 | Link problem screens (invalid, not yet open, expired, completed) | same URLs | Any candidate link | Say what is wrong and the next step | spine-only (State Patterns) |
| 8 | Section intro, optional warm-up | `/a/[token]/exam` | Check, or a section break | Rules, optional unscored practice, "Bölümü başlat" | Flow 1 |
| 9 | Question screens: Dilbilgisi (C-test, cloze, word bank and choice), Okuma, Dinleme, Yazma, Konuşma | `/a/[token]/exam` | Section intro | Answer; fixed form with back, flag, review and a fixed one-row bottom bar | Flow 1 |
| 10 | Review ("Bölümü gözden geçirin") | `/a/[token]/exam` | Last item ("Bitir") | See empty, partial and flagged; jump back; finish once | Flow 1 |
| 11 | Section break | `/a/[token]/exam` | Finishing a section | Mascot, progress, "Sıradaki bölüm" | Flow 1 |
| 12 | Proctor warning, recover panel, reload gate | over the exam | A detected event, a lost permission, a page reload | Say what was recorded; get back in | Flow 1 (branch) |
| 13 | Finish screen | `/a/[token]/done` | Last section | Close the exam; show the level only if the school released it | Flow 1 |
| 14 | Today ("Bugün") | `/dashboard` | After sign-in | The one thing to look at next | Flow 2 |
| 15 | Students list with results | `/exam/students` | Menu | Invites, section progress, status, level | Flow 2 |
| 16 | Invite wizard: "Öğrenciler", "Sınav ve zorluk", "Son bir bakış" | `/exam/students/new` | Today, Students | Invite a cohort; set "Zorluk" | Flow 2 |
| 17 | Student result and review | `/exam/students/[id]` | Students list | Accept or change AI proposals; "Sonucu kesinleştir" | Flow 2 |
| 18 | Proctoring (integrity) report | `/exam/students/[id]/integrity-report` | Result | Evidence, events, closing decision | Flow 2 |
| 19 | Level report, print and PDF | `/exam/students/[id]/report` | Result | A forwardable record with the Campus German footer | Flow 2 |
| 20 | Exams and exam editor | `/exam/exams` | Menu | Blueprint list and editor | spine-only |
| 21 | Question bank | `/exam/bank` | Menu | Approve, edit, generate questions | spine-only |
| 22 | Advanced ("Gelişmiş"), one AI box | `/advanced` | Menu | Describe what you want; AI proposes | spine-only |
| 23 | Settings, users, audit | `/settings` | Menu | Organization and access | spine-only |
| 24 | Openings list and "Alım aç" wizard (3 steps) | `/hiring/openings`, `/hiring/openings/new` | Menu, Today | Describe the role, review questions, publish | Flow 3 |
| 25 | Invite candidates (sheet) | `/hiring/invite` | Right after publish, Candidates | Send candidate links | Flow 3 |
| 26 | Hiring candidate flow: welcome and consent, info, device check, warm-up, stage intro, activities, between stages, done | `/a/[token]/...` | Invite link | A candidate does the assessment, once, without surprises | Flow 4 |
| 27 | Candidates, candidate detail, independent review and scoring, compare, decision | `/hiring/candidates...` | Menu | Review and decide | spine-only (visual tokens and Component Patterns apply; interaction is specified in HIRING-UX 5.13 to 5.17) |
| 28 | Library: positions, competencies | `/library/...` | Menu | Shared definitions | spine-only |

"Covered by" names the flow that walks through the surface. "spine-only" means the surface is specified in these two files only, with no flow and no mockup of its own.

**Panel menu** (white side menu, `{spacing.panel-nav}` wide, `{rounded.full}` items): Bugün; group "Sınav" (Öğrenciler, Sınavlar, Soru bankası); group "İşe alım" (Adaylar, Alımlar) with Library items under it; Gelişmiş; Ayarlar. Group labels disappear when an organization uses only one solution. The lockup with its byline sits at the top; language switch and the signed-in person at the bottom. Modals stack one level deep.

**Candidate frame:** a bar with the lockup on non-question screens, the school name and a language picker (flag, the language's own name, a menu of the five candidate languages: Türkçe, English, Deutsch, Español, العربية; Arabic lays the page out right to left while German content stays left to right); the exam question bar replaces it while a question is on screen. The picker is offered again on each section intro but never on a question screen, so the language cannot change under an answer. No in-product navigation between candidate screens; progress is linear.

## Voice and Tone

Microcopy only; the look of a message lives in `DESIGN.md`. Calm, plain, unhurried; never blaming, never cheering a score.

**Address.** Exam surfaces (welcome, check, runner, finish): "siz". Hiring candidate surfaces and the hiring wizard: "sen". Teacher panel: "sen" for new copy [ASSUMPTION: the brief fixes only student "siz" and hiring "sen"; the shipped panel mostly says "sen" but sign-in mixes "hesabınızla" and "yaz"]. English uses "you" throughout and every Turkish key has an English key.

**Rules.**

- Plain, everyday Turkish that a student, teacher or parent understands at once, without explanation (the owner's approval condition, memlog 2026-10-16). Ask questions directly ("Bölümü bitirmek istiyor musunuz?"), not with a stiff passive ("Bölüm bitirilsin mi?"). In anything a student or parent reads, say "bilgi", not "kanıt".
- Sentence case. Short sentences. One idea per sentence. No exclamation marks except the single welcome greeting ("Hoş geldiniz, Elif!") [ASSUMPTION: the mockup has one exclamation mark; the rule itself is a proposal].
- Say what was recorded or saved and what happens next. Tell the student the clock state whenever it matters: "Süre işlemeye devam ediyor."
- Never judge. No "doğru", "yanlış", "harika", "tebrikler" about answers. The mascot's only lines are about finishing a section.
- To a candidate, never "hile", "ihlal" or "şüpheli". The proctor card is titled "Uyarı" and states the rule as a rule, not as an accusation.
- A disabled button names its reason in the same place: "Başlamak için önce şunu tamamlayın: Ekran paylaşımı".
- Errors say what happened and the next action: "Kaydedilemedi, tekrar deniyoruz."
- Levels are always written `A1 A2 B1 B2 C1 C2`, tabular, with their source nearby. Difficulty (teacher panel only) is always `Kolay`, `Orta`, `Zor`, paired with its step glyph; the tint behind them is a redundant third signal.
- Overline labels set in capitals use the Turkish locale so "i" and "ı" capitalize correctly.

| Do | Don't |
|---|---|
| "Bu an kaydedildi ve öğretmeninize bildirildi." | "Hile tespit edildi!" |
| "Süre işlemeye devam ediyor." | "Acele edin, süre azalıyor!" |
| "İlk bölümü bitirdiniz. Hazır olduğunuzda devam edin." | "Harika! Hepsi doğru!" |
| "Kaydedildi · 4 sn önce" | "Cevabınız başarıyla kaydedildi ✓" |
| "Bu bölümde sesli konuşmayın." | "Kural ihlali: ses" |
| "Sonuç için yeterli bilgi yok. Okulunuz sizinle iletişime geçecek." | "Sınavı geçemediniz." |
| Panel: "Sizi bekliyor", "Sonucu kesinleştir" | "Hata: işlem başarısız oldu" |
| Hiring: "Merhaba Can. Bu değerlendirme, seninle tanışmadan önce nasıl düşündüğünü anlamamız için hazırlandı." | "Sayın aday, aşağıdaki testi tamamlamanız zorunludur." |

**Glossary.** Bölüm (never "modül"), Soru, Davet, Zorluk, Sonuç, Seviye, "bir Campus German ürünü". One wording for an outcome that could not be verified: "doğrulanamadı" (never "doğrulanmadı").

## Brand placement

This section is new: it turns the standing decisions (byline on front doors, none on the running exam, no outbound link) into a placement map. The **Never** cells and the byline-on-front-doors rule come from the user's earlier decisions; every other cell is an `[ASSUMPTION]`.

| Surface | Kademe mark and wordmark | Byline "bir Campus German ürünü" | Mascot | Notes |
|---|---|---|---|---|
| Panel sign-in | Lockup, `{typography.wordmark}` | Yes | No [ASSUMPTION: teachers sign in daily; keep it quiet] | Faint cream leaves allowed |
| Candidate welcome (exam and hiring) | Lockup, large | Yes | `wave`, hero | The school's own name is a neutral chip beside it; it carries no Campus German glyph [ASSUMPTION: resolves the mockup's chip that reused the petal glyph] |
| Info, system check | Lockup in the candidate bar | Yes [ASSUMPTION: the clock is not running] | No (a face next to a camera preview is confusing) [ASSUMPTION] | |
| Section intro, section break | Candidate bar with lockup | Yes on intro [ASSUMPTION]; break shows mark only | `celebrate` on the break, only after a section is finished; the intro of section 1 waves (`wave`, small, in the progress strip), later intros celebrate | The bar carries the record indicator from the first section on (the shipped runner shows it on the intro too) and no timer |
| Question screen | Mark and word "Kademe" in `{typography.wordmark-sm}` | **Never** | **Never** | The bar, the passage and the bottom bar carry no brand message |
| Proctor warning | None | **Never** | **Never** | The yellow glyph tile is the only illustration |
| Finish screen | Lockup | Yes | `celebrate` | Level, if released, is shown as text |
| Panel menu | Lockup at the top, `{typography.byline-sm}` | Yes | No (only `rest` on empty states, `think` in wizards) | |
| Wizards ("Alım aç", invite) | In the menu only | No | `think` peeking over the card corner on decision steps | |
| Printed reports | Small mark in the header | One footer line: "Bu rapor, Campus German'ın Kademe platformuyla hazırlandı." | No | The school's name stays the school's |
| Candidate screens, any | | **No link to campusgerman.com** (it would lead a student out of a proctored exam) | | |

The full Campus German logo image is not placed in product UI; the byline uses only the three-petal glyph (DESIGN.md, Brand & Style) [ASSUMPTION].

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md`, Components.

| Component | Use | Behavioral rules |
|---|---|---|
| Primary button `{colors.primary}` | One per screen | Label is a verb. When not usable it is `button-disabled` and the reason sits beside it. A working button stays focusable and announces its work in the footer's polite region. |
| Step footer | Candidate step screens; the panel's wizards | Back on the left, reasons and the one primary on the right, always in the same place. On the candidate side it is fixed to the window bottom with a spacer; in the panel it sticks to its column. The exam's question bar is its fixed-size variant (next rows): it never changes height and its warnings float above it. |
| Wizard (GuidedFlow) | Invite, "Alım aç", exam create | One question per step, "Adım n / 3" chips (`wizard-step-done`, `-now`, `-todo`), back keeps state, the primary is "Devam" until the last step. |
| Section chip | Welcome, intro, exam bar | Icon plus word, neutral. Never a button, never a color-coded filter. |
| Exam bottom bar | Fixed-form sections | One row, 66px, never wraps: a square "Geri" button (disabled on the first question), the cell strip with a "?" legend popover, "İşaretle", and "Sonraki" ("Bitir" on the last question, which opens the review step). Moving on never asks; the save state is spoken, not drawn. |
| Question strip (cells) | Exam bottom bar | One cell per item; click jumps. It stays on one line and scrolls sideways when the section is long, without a scrollbar, with a fade at the edge that still hides cells; the cell on screen is brought into view when the student moves. States: empty, answered, partial ("Yarım"), flagged; the item on screen has the current ring. The "?" button opens a small popover naming the colors and the flag. It reports filling, never correctness. |
| Part counter chip | Question header | "1/4" for a question of several parts: how many of its own parts are filled. Absent for a one-part question. Never says right or wrong. |
| Flag toggle | Exam bottom bar | "İşaretle" becomes "İşaretlendi" (yellow, `aria-pressed`, the help text says pressing again removes it); the cell gains the flag badge. Flags are the student's own reminder and appear on the review screen. A listening page flags each question on its own. |
| Floating notice | Over the exam bar | A `notice-warn` just above the bar, no height added to it, for a failed save or action (with a retry), for "Kayıt hâlâ çalıyor. Yine de geçilsin mi?" ("Yine de geç" / "Kalayım") and for "Süre doldu. Kaydedilmiş cevaplarınız sayılıyor.". `role="alert"` for the first two, `role="status"` for time up. |
| Review screen | After the last item | Lists flagged, empty and partial items as jump buttons; "Sorulara dön" goes back, "Bölümü bitir" opens the finish dialog. Finishing cannot be undone. |
| Finish dialog | Review screen | Title "Bu bölümü bitirip devam etmek istiyor musunuz?"; one line with the counts ("2 soru boş, 1 soru yarım, 1 soru işaretli." or "Tüm sorular cevaplandı.") and "Bitirdikten sonra bu bölüme geri dönemezsiniz." The safe choice is first and says where it leads ("Sınava geri dön"); the confirm names the next step ("Evet, sonraki bölüme geç", in the last section "Evet, sınavı bitir"). |
| C-test pool and gaps | Dilbilgisi C-tests | One shared pool of word parts, sticky above the bottom bar. All gaps of an item are equal width. A part is placed by drag or by click; a placed part leaves the pool; clicking a filled gap returns it. |
| Matching tray | Okuma matching | A pinned tray of letters; click a row to select it, then a letter; one list only, with a German note when targets are just "Anzeige A..F". |
| Single choice | Dilbilgisi, Okuma, Dinleme | Four options A to D, a radio group, arrow keys move, only the picked option (or the first) is a tab stop. |
| Richtig / Falsch / Nicht im Text | Okuma true-false | Three German-labeled buttons per statement, a radio group. |
| Listening page | Dinleme | All items of one recording on one page; sticky player on the left, questions on the right; plays are limited and shown ("1 / 2 dinleme"). **Read first:** the questions show at once but the player waits behind a card ("Önce soruları ve şıkları okuyun. Hazır olduğunuzda dinlemeye başlayın. Kayıt 2 kez çalınabilir.", button "Soruları okudum, dinlemeye başla"); once opened it stays open, also after a reload or when the recording has been played. Leaving mid-play asks in the floating notice above the bar. |
| Writing field | Yazma | Spell-check and paste off; word counter; autosave; no judgement of content. |
| Speaking card | Konuşma | Task card ("Thema", "Karte"), think time then recording, the camera is already on; retries only if the exam allows. |
| Timer pill | Exam bar, centered (owner 2026-10-23) | Server clock, tabular, never blinks, never turns red. The pill turns yellow-soft from 5 minutes left (sections longer than 10 minutes) and in the last 2 minutes; a small callout under it announces each threshold once per section run. |
| Record indicator | Exam bar | States what is being captured: "Kamera, ses ve ekran kaydediliyor"; always visible during the exam. |
| Proctor warning | Over the exam | `role="alertdialog"`, content behind is inert, focus trapped on the one button, Escape does nothing, the counter is per attempt, the clock note is always present. The button dismisses; it does not end anything. |
| Zorluk selector | Invite step 2 (verification exams only) | Three tiles, Kolay, Orta and Zor, each with its step glyph, the word and a short hint; exactly one is selected. Teacher panel only, on the `diff-*` tints. Details below the table. |
| Result row | Students list | A whole-row link [ASSUMPTION: the mockup draws rows as cards; the click target is carried over from the Today queue in EXAM-UX 4.1]. Shows the difficulty chip (teacher panel only; `diff-*` tint, step glyph, word), five section statuses (done, running, waiting; icon plus shape plus word), the state in words and the level badge only when there is one. A verification that did not verify shows the yellow-soft `review-badge` "Gözden geçir" and the sentence "Beyan edilen seviye doğrulanamadı" in place of a level badge; the teacher decides. |
| Notice | Problems and information | `notice-warn` for anything that failed (device, connection, save, action, AI): what happened, then the next action, with a retry button when there is one. It never blames the student and is never red. `notice-neutral` for plain information. It is not a toast and stays until the cause clears or the person acts; `role="alert"` for warn, `role="status"` for neutral. |
| System check step | Candidate, four steps | One device per step; the step chips show where you are; the primary is the step's own action and becomes "Tekrar dene" after a failure; a failed step shows a notice with "Nasıl düzeltirim?" and "Sorun bildir"; the last step's primary is "Tam ekrana geç ve sınavı başlat" and gives its reason when disabled. |
| Section intro | Candidate, start of each section | Rules, an optional unscored warm-up ("Dene" or "Geç"), then "Bölümü başlat", which starts the clock and says so beside the button. |
| AI proposal card | Result review | Never filled or accented as a decision; shows the proposal, the evidence, "Öneriyi onayla" and "Seviyeyi değiştir" (with a required reason). The teacher may decide without waiting for AI. |
| Undo strip | Panel | Appears 8 seconds after a reversible action; "Geri al". |
| Mascot | See Brand placement | Decorative, `aria-hidden`; the screen title carries the meaning. |

### Zorluk selector

Invite step 2, verification exams only. Three tiles, Kolay, Orta and Zor, each with its step glyph, the word and a short hint; exactly one is selected. The tiles use the `diff-*` tints and exist in the teacher panel only.

- **Meaning, as shipped.** The invite's level shift (`shift` -1, 0, +1) moves the questions' CEFR level. **Kolay** takes the questions one CEFR level below the declared level, **Orta** at the declared level, **Zor** one level above.
- **Hints.** "Bir seviye aşağıdan", "Beyan edilen seviyeden", "Bir seviye yukarıdan".
- **Effect sentence.** Under the tiles, one sentence names the effect for the batch's declared level ("A2 beyan eden öğrenciler için: Kolay A1, Orta A2, Zor B1 soruları gelir.") and the affected sections, as the shipped hint does ("Yalnız bu davetteki öğrenciler için geçerli; etkilenen bölümler: Dilbilgisi, Okuma, Dinleme.").
- **Limits.** It does not exist for placement exams, and it moves only fixed-set sections, not adaptive ones. It is not the question's own Kolay / Orta / Zor label inside a level (the shipped copy already says so).

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Empty list | Students, bank, openings | `rest` mascot, one sentence, one primary or a link to the next action ("İlk öğrencinizi davet edin" style). No empty table shell. |
| Zero results from a filter | Lists | The active filters as removable chips plus "Filtreleri temizle". |
| Loading | Pages, AI work | A skeleton matching the layout; AI work says what it is doing in a sentence ("AI önerisi hazırlanıyor, genelde 1 dakika") with a "Yenile" link; the page does not refresh itself. |
| Saving | Writing, answers | "Kaydediliyor..." then "Kaydedildi · 4 sn önce". |
| Save failure | Exam | The floating notice above the bar: "Son değişikliğiniz henüz kaydedilmedi. Bu sekmede tutuluyor ve yeniden gönderiliyor." with "Tekrar dene". The student keeps working. |
| Action failure | Any | A `notice-warn` beside the action: ink on yellow-soft with a `!` disc and the next action; never a toast, never a modal, never red [ASSUMPTION: the visual form is derived, the picked mockup draws no error; the key-errors mock draws it]. |
| Field error | Forms (info, sign-in, invite) | The field's frame turns `{colors.error}` and a `!` glyph appears with a message in ink under it that says how to fix it ("Geçerli bir e-posta adresi yazın."). Focus moves to the first bad field; no toast. This is the only red the exam and panel forms use. |
| System check problem | Candidate check | A `notice-warn` inside the step card with the fix in ink (the shipped line: Pencere veya sekme değil, Tüm ekran seçeneğini seçin. Sonra tekrar deneyin.); the primary becomes "Tekrar dene". Replaces the shipped red-soft box with red text (IntroConsent.tsx:244, SystemCheck.tsx:275). |
| Proctor warning | Over the exam | The warning card. Kinds: telefon, başka kişi, sekmeden ayrılma, ikinci ekran, kopyala-yapıştır, çift sekme, yanlış ekran paylaşıldı, bakış, yüz yok. Text per kind: what was recorded, the rule, "Bu sınavdaki n. uyarınız", "Süre işlemeye devam ediyor. Kalan süre: mm:ss". A persistent kind (second screen) keeps the button waiting until the cause is gone ("İkinci ekran hâlâ algılanıyor"). One button: "Anladım, sınava dön". |
| Recoverable permission loss | Over the exam | A recover panel instead of the warning: "Tam ekrandan çıktınız" with "Tam ekrana dön", "Ekran paylaşımı durdu" with "Paylaşımı yeniden başlat", "Kamera kapandı" with "Kamerayı aç"; the content stays inert until fixed; the clock note is present. |
| Soft notice | Exam | A line under the bar for "Yüzünüz kamerada görünmüyor. Kameraya dönün." and "Bu bölümde sesli konuşmayın." (they clear themselves); "Bu an kaydedildi, öğretmeniniz inceleyecek." for 6 seconds. |
| Offline | Exam | A calm strip on `{colors.yellow-soft}` (a `notice-warn` strip): the connection dropped, recording and answers are kept and sent when it returns, the clock keeps running [ASSUMPTION: wording derived from HIRING-UX 6.12 and the recording-safety strings]. Chunks that cannot upload wait; the end-of-exam recording-safety copy says how many parts have not been sent yet and asks to keep the tab open. |
| Page reload mid-exam | Exam | Reload gate: "Sınavınız kaldığı yerden devam ediyor"; only the permissions that must be re-given are rows (camera, screen, full screen); "Süre bu sırada işlemeye devam etti"; primary "Devam et". |
| Time up | Exam | The open item is submitted on its own; the floating notice says "Süre doldu. Kaydedilmiş cevaplarınız sayılıyor." and the flow moves to the next section intro. Never a failure tone. |
| Section break | Between sections | `celebrate` mascot, one sentence, "n / 5 bölüm tamamlandı", the next section's name, primary "Sıradaki bölüm". The next section's clock starts only on "Bölümü başlat". |
| Finish | End | "Sınavınız tamamlandı." plus "Kamera, mikrofon ve ekran paylaşımı kapatıldı." Then, by the school's release setting: nothing ("Sonucunuzu okulunuz size iletecek."), pending ("Yazma ve konuşma cevaplarınızı öğretmeniniz değerlendiriyor"), or the level as text. The verification outcome is a plain sentence in a `notice-neutral` ("Beyan ettiğiniz seviye bu sınavda doğrulanamadı." or "Sonuç için yeterli bilgi yok. Okulunuz sizinle iletişime geçecek."), never colored by the result. Terminated variant: a neutral reason and "Okulunuzla iletişime geçin". Under the result, a quiet text button "Sınavda bir sorun yaşadınız mı?" opens a short field ("Ne oldu? Kısaca yazın.", "Bildir"); it needs words before it sends, says "Teşekkürler, okulunuza iletildi." when it has, and on a failure asks to check the connection and try again. The school reads the report on the student's page. |
| Desktop only | Candidate on a phone | "Bu sınav bilgisayarda yapılır", the reason (screen sharing is not possible on phones), "Linki kopyala". If a section clock is already running, the screen says so and tells the student to continue on a computer. |
| Link problems | Candidate | Invalid, not yet open ("Sınavınız ... açılacak" with the date and zone), expired, completed (variant of the finish screen), closed. Each carries its next step. |
| AI unavailable or failed | Panel | "AI önerisi üretilemedi: neden. Seviyeyi siz verin." plus the level segment. The teacher is never blocked. |

## Interaction Primitives

- **Chip drag with a click fallback.** A C-test part or a matching letter moves by **pointer drag** (mouse, trackpad, pen) or by **click**: a click places the part into the selected gap, or into the first empty gap if none is selected; clicking an empty gap selects it (`aria-pressed`); clicking a filled gap returns its part to the pool. A press without movement (under about 5px) is a click. The drag listens on the whole window, so each of these ends it: a proctor warning that makes the page inert mid-drag, a release anywhere, Escape, leaving the window, or the chips becoming disabled. A chip never hangs in the air.
- **Keyboard.** Every chip and every gap is a button in the Tab order. Enter or Space on a chip places it as a click would; Enter or Space on a gap selects, deselects or returns its part. Radio groups use arrow keys, Home and End. Tab order equals reading order. The warning card traps focus on its one button and ignores Escape.
- **Flag.** A toggle in the bottom bar; instant, reversible, never confirmed.
- **Digit keys in a cloze.** Keys 1 to 4 pick the word of the open gap, only while focus is in the text or its panel (or on no control at all); with focus on the bottom bar or any other button the digits do nothing, so a pick never pulls focus off the bar.
- **Review.** Reached from the last item's primary ("Bitir"); each listed item jumps back; "Bölümü bitir" opens the finish dialog once because finishing cannot be undone. Within a section, back and forth is free until it is finished.
- **Autosave.** Answers save as the student works (typing saves as they type; choices on selection). Failures are kept in the tab and re-sent. The student does not press save.
- **Skip.** Moving on from an empty item or one with empty places asks once ("Bu soruyu boş geçmek istiyor musunuz?" or "Bu soruda boş yerler var") with the safe choice first.
- **Time.** The server clock is the only clock; the pill is for orientation. A section's clock starts when the student presses "Bölümü başlat" and the screen says so.
- **Panel.** Click a row to open it; destructive or reversible actions give the 8-second undo strip instead of a dialog; a command search is available on the panel [ASSUMPTION: HIRING-UX 4.1 specifies a command palette; its status in the shipped panel is unverified].
- **Banned:** browser `alert` and `confirm`, toasts, infinite scroll, hover-only affordances, a mascot that reacts to answers, any streak or XP mechanic.

## Accessibility Floor

Behavioral; the contrast ratios live in `DESIGN.md`, Colors.

- WCAG 2.2 AA. Every text pair in the contrast table meets 4.5:1 and every boundary a person must find meets 3:1.
- **No state by color alone:** question cells carry a corner badge shape, difficulty carries a step glyph and a word, section status carries an icon or shape and a word, a selected card carries a check or marker.
- Every cell has an accessible name in the form "5. soru, kısmen, şu an burada"; the strip is labeled "Sorular". The current item is `aria-current="step"`.
- The proctor card is `role="alertdialog"` with `aria-modal`, focus lands on its card or button on open and returns to the previous element on close, the content behind is `inert`.
- Focus is always visible: 3px `{colors.primary-deep}` ring, 3px offset, on every control; the current cell keeps its ink ring in addition.
- Controls are at least 24px in each direction on desktop; the primary controls are at least 44px tall. Cells shrink in sections with many items but never below 28px [ASSUMPTION: the section-length thresholds are not designed; the shipped strip wraps and the review screen is the full overview].
- German content has `lang="de"` and `translate="no"`; everything else follows the chosen UI language.
- The timer is not announced every second. The 5-minute and last-2-minutes callouts (once each per section run) and time-up are announced, politely (owner 2026-10-23).
- Reduced motion: the mascot pop and any progress animation are off; nothing else moves.
- At browser zoom above 100% the first screens may scroll rather than clip; the "fits without scrolling" rule applies at 100% [ASSUMPTION].
- Screen-reader titles carry the meaning of every decorative illustration (the mascot is `aria-hidden`).

## Responsive & Platform

| Condition | Behavior |
|---|---|
| Desktop 1366 x 768 and larger | The designed layouts. Candidate frame `{spacing.candidate-frame}`, exam column `{spacing.exam-column}`, manager frame `{spacing.manager-frame}`. |
| 1024 to 1365 wide | Same layouts; panel tables keep working; no new breakpoint design [ASSUMPTION]. |
| Narrower than 1024, desktop browser | Panel menu becomes a sheet; candidate screens go single column with a narrow-window strip: "Pencereni büyüt" in hiring, "Pencerenizi büyütün" in the exam, which addresses the student as "siz" [ASSUMPTION for the exam]. |
| Phone or tablet | Candidate: the desktop-only screen. Panel: read-and-decide use only; the wizard and the review screens ask for a desktop. |
| Browsers other than current Chrome or Edge | "Aynı linki güncel Chrome veya Edge ile açın." |

## Inspiration & Anti-patterns

- **Lifted:** the feel of a modern learning app (rounded, flat lip under pressables) without its mechanics, as the soft look was briefed on 2026-10-14. The professional-test structure of onSET and Goethe placement for the exam's shape (six C-tests, fixed-form sections with review), which is already shipped.
- **Rejected: streaks, XP and badges for score.** The mascot celebrates finishing a section, never a result. Student badges are for finishing only and never show a score or level.
- **Rejected: per-section colors.** The five sections stay neutral.
- **Rejected: red buttons and red alarm language.** Red is the brand, the recording dot and a small field-error frame only. A failing device or connection is a yellow notice and a proctor warning is the yellow card. Sally's review recommended neutral difficulty chips; the user overrode that for the teacher panel (DESIGN.md, Color psychology).
- **Rejected: AI marked as the star.** There are no sparkles and no "Önerilen" label on AI paths; templates are the recommended start.
- **Rejected: auto-fail by AI or by warning count.** The teacher decides.
- **Rejected: an outbound brand link in the exam.** A student must not be led away from a proctored session.

## Key Flows

### Flow 1: Elif sits the placement exam (student, "siz", Chrome on a laptop)

1. Elif opens the invite link from her school, Ege Dil Okulu. The welcome screen shows the `wave` mascot standing on the card, "Hoş geldiniz, Elif!", five neutral section pills, three needs (a current Chrome or Edge on a computer, camera and mic, the whole screen is shared), one consent checkbox and "Başlayalım". The byline is in the bar; the school's name is a chip. The screen fits without scrolling.
2. She ticks the consent. "Başlayalım" is now usable; before she ticked it, the reason sat next to it.
3. She confirms her info, then the system check runs in four steps: camera and mic, "Sizi görüyoruz" (her face is seen), "Ekranınızı paylaşın" (she picks "Tüm ekran"), "Hazırsınız" with the "Başlamadan önce" checklist; she ticks "Diğer uygulamaları kapattım, kurallara uyacağım." to unlock the button. She presses "Tam ekrana geç ve sınavı başlat".
4. The Dilbilgisi intro lists the rules and offers an unscored practice ("Dene" or "Geç"). She skips and presses "Bölümü başlat"; the intro says the clock starts now.
5. Question 5 of 6 is a C-test: in "Jeden Samstag fahre ich mit dem Fahrrad zum Markt. Dort kau_ ich fris_ Obst..." she drags the part "fe" into the gap after "kau". The gap fills; the pool loses that chip. The cell for question 5 shows the partial badge, then answered. She flags question 3 to come back to.
6. She switches to another tab by accident. A big card appears: a yellow `!` tile, "Sınav sekmesinden ayrıldınız", the rule, "Bu an kaydedildi ve öğretmeninize bildirildi.", "Bu sınavdaki 1. uyarınız", "Süre işlemeye devam ediyor. Kalan süre: 28:31". She presses "Anladım, sınava dön". No score, no accusation, the clock never paused.
7. On the last item the primary reads "Bitir". The review lists question 3 as flagged and question 6 as empty; she goes back to both, then "Bölümü bitir" and confirms once.
8. **Climax:** the section break. The `celebrate` mascot, one sentence ("İlk bölümü bitirdiniz. Hazır olduğunuzda devam edin."), the first of five progress segments filled in. Nothing on the screen says how any answer went. She exhales and presses "Sıradaki bölüm".

Branches:
- **Screen share stops** in Okuma: the recover panel "Ekran paylaşımı durdu" with "Paylaşımı yeniden başlat"; the exam content is inert until it is back; the clock note is present.
- **Page reload:** the reload gate "Sınavınız kaldığı yerden devam ediyor" returns her to the same item once she re-gives camera, screen and full screen.
- **Time runs out** mid-item: her saved answers count; "Süre doldu. Kaydedilmiş cevaplarınız sayılıyor." and the next section intro opens.
- **She opens the link on her phone first:** the desktop-only screen with "Linki kopyala".

### Flow 2: Selin Hoca invites a cohort and reads the results (teacher, "sen")

1. Selin Hoca opens the panel and signs in with the panel password; the sign-in shows the lockup with the byline.
2. Today shows the next thing to look at; she presses "Öğrenci davet et".
3. Step 1 "Öğrenciler": she pastes 12 names and e-mails; the list is checked inline (duplicates, wrong rows) and the primary stays disabled with its reason until the list is clean.
4. Step 2 "Sınav ve zorluk": the `think` mascot peeks over the card corner. She picks "Seviye doğrulama", declares level A2, then chooses **Zorluk** on the same step. There are three tiles: Kolay (one step), Orta (two) and Zor (three), each on its tint and with its hint ("Bir seviye aşağıdan", "Beyan edilen seviyeden", "Bir seviye yukarıdan"). The sentence under them says what it means for her A2 students. She picks "Orta", so they get A2 questions.
5. Step 3 "Son bir bakış": the summary (12 students, the exam, Orta, the link expiry) and "12 daveti oluştur". The links are shown once to copy (the platform does not send e-mail).
6. Days later, the Students list shows a row per student: Elif Yılmaz, Orta, five section statuses, "İnceleme bekliyor", level badge B1.
7. She opens Elif's result. The AI's proposal for Yazma and Konuşma is shown as a proposal with its evidence. She accepts one and changes the other with a reason. The integrity report lists one warning (left exam); she reviews the event and closes the report with the decision "Geçerli" (the options in EXAM-UX 4.4).
8. **Climax:** the checklist that read "Sizi bekliyor" is empty. She presses "Sonucu kesinleştir"; the level B1 and its source ("AI önerdi, Selin onayladı") settle in. She prints the level report; its footer reads "Bu rapor, Campus German'ın Kademe platformuyla hazırlandı."

Branches:
- AI is still preparing: she may decide anyway; the card says so and offers "Yenile".
- A student shows "Davet edildi" for a week: the row offers to extend the link, with an undo strip.
- She picks a placement exam: the Zorluk choice does not appear, because it does not apply there.

### Flow 3: Ahmet Bey, a school owner, opens a hiring round (hiring wizard, "sen")

1. From the Alımlar page he presses "Alım aç" [ASSUMPTION: the entry point is the openings page, as in HIRING-UX 5.2]. Step 1 "Rolü anlat" asks one thing: "Kimi arıyorsun?" He types "Almanca öğretmeni arıyorum, hafta içi akşam çalışacak." The `think` mascot peeks over the corner.
2. The tool asks a few short questions as cards with 2 to 5 option chips and an "Başka" box; "Bu kadar yeter, devam et" is always there. It ends with a summary card of 3 to 5 lines he can fix in place, and "Soruları hazırla".
3. Step 2 "Sorular": the AI's draft questions are all already added. One box, "AI'a söyle", changes the whole list ("Daha kısa yap"); a change comes with "Geri al". A single line says how many competencies are measured and "Değiştir".
4. Step 3 "Önizle ve yayınla": a short preview of what a candidate sees, the team ("Sadece sen", "Kişi ekle"), an optional deadline, the rules collapsed. The primary is "Yayınla".
5. **Climax:** he publishes and the invite sheet opens at once with the first candidate link ready to copy. The round that existed only in his head is live.

Branches:
- AI is unavailable: "AI şu an kullanılamıyor. Şablondan ya da kendin başlayabilirsin." Ready templates are offered.
- The assessment is not publishable yet: "Yayınla" is disabled and says why beside it.

### Flow 4: Can completes the hiring assessment (hiring candidate, "sen")

1. Can opens the link on his laptop. The welcome greets him by name, names the school and role, shows three facts (stages, estimated time, deadline), says who evaluates him and that AI does not score or rank him, and lists what is recorded. "Başlayalım" waits for his consent.
2. He confirms his info, then a short device check (camera, mic, a 5-second test recording that goes nowhere) and an unsent warm-up question.
3. Stage 1 starts only when he presses "Aşamayı başlat"; the intro says the clock starts then. He answers; thinking time is flexible; one retake is available.
4. Between stages: "Aşama 1 tamamlandı. Cevapların kaydedildi."
5. **Climax:** the done page. It says what happens, when and who: how many people will review, the date by which the school will reply, and a contact address. His camera and mic are shown as closed.

Branches: the link expired (a "Yeni link iste" request); he opens it on a phone (the desktop-only screen); his connection drops (a calm strip says recording is kept and the clock keeps running).

## Key screens

1:1 visual references, in `mockups/`, for the surfaces the picked mockup ([direction-sicak-yumusak.html](mockups/direction-sicak-yumusak.html)) did not draw (desktop, 1366 wide; first-screen mocks mark the 650px line of a real laptop). Each file's `<style>` comment names the spine sections it follows.

- [Panel sign-in](mockups/key-sign-in.html): IA 1; Brand placement; Voice (panel "sen").
- [System check, screen-share step and its problem state](mockups/key-system-check.html): IA 5; Flow 1 step 3; State Patterns (System check problem).
- [Section intro, Dinleme](mockups/key-section-intro.html): IA 8; Flow 1 step 4; Component Patterns (Section intro).
- [Review before finishing a section](mockups/key-review.html): IA 10; Flow 1 step 7; Component Patterns (Review screen, Question strip).
- [Error, empty, offline and time-up states](mockups/key-errors.html): State Patterns; Voice.
- [Printed level report, verified and not verified](mockups/key-level-report.html): IA 19; Brand placement (printed reports).
- [Invite step with Zorluk tiles, and the results list](mockups/key-panel-invite.html): IA 15 and 16; Flow 2 steps 4 and 6; Component Patterns (Zorluk selector, Result row).

## Open items

- **Real viewport.** The picked mockup budgets 768px of viewport height; a physical 1366 x 768 laptop gives about 650px. The sign-in, system check, section intro, review and invite-step mocks are drawn to fit 650px and show the line. The picked mockup's own welcome screen was not re-fitted: measured in Chrome, its "Başlayalım" button ends at 684px of the 768px viewport, 34px below the 650px line, so it would scroll on a real 1366 x 768 laptop.
- **Back control.** The mockup's bottom bar has no back button; the shipped exam has one. The spine adds a text "Önceki".
- **Long sections.** The question strip is drawn for 6 items. Sections with 12 or more items are undefined in the mockup.
- **Per-section dot.** The memlog still lists "no per-section dot" as unconfirmed.
- **Mascot and mark colors.** The yellow mascot body and yellow tallest step are a memlog assumption the user has not answered separately.
- **Difficulty chip placement.** Sally's question 3 (a chip on every student row, or once in the invite's group header) is not decided; the mocks keep the chip on each row, as the picked mockup does. The bank's own Kolay / Orta / Zor label inside a level shares the words; whether it gets the same chip is not decided (the bank is spine-only here).
- **Warning counter.** Sally suggested a neutral cream counter pill instead of yellow-soft because the tile is already yellow; the memlog did not adopt it, so the counter stays yellow-soft.
- **In-app confirm dialog.** "Bölümü bitirmek istiyor musunuz?" and the skip confirmations are specified as behavior only; their visual (a small card over the scrim) is not drawn.
- **Sign-in copy.** The shipped line "Sınav linkiniz e-postayla gönderildi" contradicts the invite flow (links are not e-mailed); the sign-in mock words it as "Sınav linkinizi okulunuz iletir".
- **Address in the panel.** Sign-in and some shipped panel copy mix "siz" and "sen".
- **Hiring candidate review screens** (candidates, scoring, compare, decision) are listed as spine-only here; they were not part of the picked mockup. Print stylesheet beyond the level report is not specified.
