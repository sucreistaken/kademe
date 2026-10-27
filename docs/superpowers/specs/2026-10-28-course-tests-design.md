# Course tests: Zwischentest and Abschlusstest (2026-10-28)

The user brought three documents from a Campus German teacher (Halil Bey): the written B1 end-of-course test
(`Abschlusstest_B1_Schriftlich_VersionA_SCHUELER.docx`), its marking sheet with an AI prompt for the writing part
(`Bewertungsbogen_B1_VersionA_LEHRKRAFT.docx`) and the oral pair exam guide (`Muendliche_Pruefung_B1_VersionB_
LEHRKRAFT.docx`). Text extracts: scratchpad `halil/` of the 2026-10-28 session; the originals stay in the user's
Downloads, not in the repo. The school's own test, so its wording may be used as is (unlike publisher material).

Decided with the user in a question round (Turkish quotes, then the decision). After the design the user said
"direkt bu görevi bitirene kadar çalış, en sonda canlıya alınsın, Halil Beye bir şey sorma, kendi içinde araştırarak
çöz": no review stops, no questions to the teacher, one deploy at the end. Open teacher questions are answered by
the lead below (marked "lead") and listed at the end for the owner to overrule.

## Ledger

1. "ikisi de olsun ... profesyoneller nasıl yapıyorsa": two tiers, like publisher test books (chapter progress tests
   plus an exam-style level test). Named by the user "Kurs ara sınavı" and "Kurs sonu sınavı".
2. "Tamamen Kademe'de": the whole test runs in Kademe, speaking included (single candidate, recorded). No pair exam.
3. "bunu örnek alsan diğerlerine uygulasan da okey": Halil Bey's B1 is the template; every other form is written by
   us in his format.
4. "konuşma kısmında bir tane maskot koyabilirsin ... konuşuyormuş gibi", then "çok basit tut": the mascot stands
   next to the speaking task and "says" it in a speech bubble with a talking mouth. No audio, no dialogue.
5. Syllabus: Netzwerk neu (Klett), 12 chapters per level, `.1` = Kap. 1-6, `.2` = Kap. 7-12 (Halil Bey's sheet sends
   B1.2 to "Kapitel 7"). Only topic names and chapter themes are used, never book text.
6. "A1 A2 B1 B2 bunlar olsun"; Netzwerk neu ends at B1, so B2 has no book: "Kitapsız, CEFR B2 konuları".
7. Listening is added (Halil Bey's written test has none; Goethe, telc and ÖSD all have it).
8. Approach A: a new exam mode inside the language exam, sharing every candidate screen, proctoring, invite and
   report path.

## The eight tests

| Key | Kind | German name | Scope | Pass | Not passed |
|---|---|---|---|---|---|
| A1.1, A2.1, B1.1, B2.1 | Kurs ara sınavı (INTERIM) | Zwischentest A1.1 | chapters 1-6 of the level (B2: first half of the B2 list) | continue in L.2 | repeat L.1 |
| A1, A2, B1, B2 | Kurs sonu sınavı (FINAL) | Abschlusstest A1 | the whole level | next level, X.1 | by band: L.2, L.1, or the level below |

No separate test at the end of `.2`: the Abschlusstest is that test. Each test has two parallel forms, A and B:
16 forms.

## Format

telc order (Lesen, Sprachbausteine, Hören, Schreiben, Sprechen), which keeps Halil Bey's order and slots listening
in. One point per scored unit (statement, question, gap), no half points.

| Section | INTERIM | FINAL |
|---|---|---|
| Lesen (READING) | 6: 3 Richtig/Falsch on one text, 3 "which text" (a/b/c over texts A-D) | 10: 5 + 5 (Halil Bey's B1 layout) |
| Sprachbausteine (GRAMMAR) | 15: a cloze text with 6 gaps (a/b/c), 9 single sentences (a-d) | 25: 10 gaps + 15 sentences |
| Hören (LISTENING) | 6: 3 short announcements (a/b/c), one conversation with 3 Richtig/Falsch | 10: 5 + 5 |
| Schreiben (WRITING) | one email, rubric 9 | one email, rubric 9 |
| Sprechen (SPEAKING) | 2 tasks: introduce yourself, card talk | 3 tasks: + proposals/opinion (Halil's planning card as a monologue) |
| Points / time | 56 / about 55 min | 74 / about 85 min |

Section minutes: INTERIM Lesen 12, Sprachbausteine 12, Hören 10, Schreiben 15, Sprechen (task timers);
FINAL Lesen 20, Sprachbausteine 20, Hören 15, Schreiben 25, Sprechen (task timers).

Level adaptation (lead, from Goethe/ÖSD/telc task shapes):
- A1: Schreiben a short message, 25-40 words, 3 points to cover, informal or formal as the task says. Sprechen:
  introduce yourself (think 30 s, answer 60 s), card talk on an everyday topic with 3 cue words (think 60 s, answer
  60 s), FINAL adds asking for/offering something (think 30 s, answer 45 s). Mascot text bubble shows the task in
  simple German.
- A2: Schreiben 40-60 words. Sprechen: introduce yourself (30/60), talk about your life with 4 points (60/90), FINAL
  adds planning proposals (60/75).
- B1: Halil Bey: Schreiben 60-80 words formal email; Sprechen: introduce yourself (30/60), presentation with 4
  points (60/120), FINAL adds proposals for a shared plan (60/90).
- B2: Schreiben 120-150 words (formal letter or forum post with an opinion). Sprechen: introduce yourself (30/60),
  presentation with 4 points (90/150), FINAL adds discussing a proposal with arguments (60/120). Lesen
  statements use Richtig / Falsch / Nicht im Text (bank rule for B2+).

Rules kept from the bank: instructions in ÖSD/telc style, never "ziehen"; never ask about origin, age or religion
("Ihre Stadt oder Region": Halil Bey's card item "Herkunft / Heimatstadt" is replaced); A1-B1 Richtig/Falsch, B2
adds Nicht im Text; formal Sie in instructions.

## Speaking (simple)

The existing speaking task (prompt card, think timer, one recording, no retake: `maxTakes` 1). For COURSE_TEST
the task screen shows the mascot (Canlı basamak) beside the card, with the task's first sentence in a speech
bubble that types in while the mouth moves (a `talk` state, CSS only, stops when the text is complete and
respects `prefers-reduced-motion`). No sound, so no proctoring change. This is a deliberate exception to "mascot
never on a question screen", for the speaking task of a course test only (docs/design/RULES.md notes it).

## Scoring and result (lead, from Halil Bey's sheet)

- Objective section points = scored units right, counted like `answer-tally.ts` (one unit per gap, statement,
  question; "accepted as correct" by a teacher counts). Max = units in the form.
- Writing: one rubric grading, criteria INHALT, WORTSCHATZ, GRAMMATIK, each 0-3 (max 9). Halil Bey's rules carry
  over: all points with both halves = 3, a missing half or missing/informal greeting or word count 45-54/91-105 (B1;
  scaled to each task's range) = 2, only two points or far too short = 1, one point, off topic, under a third of
  the minimum or mostly copied = 0. Duzen in a formal task caps INHALT at 2. Copied task sentences do not count as
  words. A1-B2 descriptors come from the same sheet scaled to the level.
- Speaking: per task one rubric grading, criteria KOMMUNIKATION, WORTSCHATZ, GRAMMATIK, AUSSPRACHE, KOHAERENZ,
  each 0-4 (Halil Bey's descriptors). Section points = floor(mean of the task totals) (max 20); "keine halben
  Punkte, kein Aufrunden". AUSSPRACHE may come back "not assessable" from a transcript; then the teacher sets it.
- AI proposes, a teacher confirms or overrides every productive grading (owner rule). Empty, skipped or
  never reached task: rule proposal of all zeros. A failed upload or transcription is never zero: the teacher
  decides.
- Rules, as percentages of the form's maximum, compared with `points >= ceil(pct * max / 100)`:
  - INTERIM: pass at 60% and writing INHALT > 0.
  - FINAL (Halil Bey's 64-point table turned into shares: 42/64, 38/64, 28/64): pass at 65%, speaking at least
    60% of its maximum, writing INHALT > 0. Not passed: band 59-65% -> L.2, 43.75-59% -> L.1, below -> the level
    below (`.2` course; for A1: A1.1 again). A student under the speaking minimum or with INHALT 0 who is
    otherwise at 65% gets L.2 with a speaking/writing focus flag ("Schwerpunkt Sprechen" / "Schreiben").
  - Pass recommendation: INTERIM -> L.2, FINAL -> next level .1 (B2 -> C1.1).
- The result is PENDING until every productive grading is confirmed, then READY; the teacher finalizes and may
  override PASS/FAIL with a reason (existing override path). No CEFR level estimate is shown for a course test.

## Teacher and student

- Invite: the students wizard gets the two course test kinds, then the course (A1.1 ... B2). Forms are given A, B,
  A, B in the order of the pasted list; a returning student (same email) gets the form they have not seen; the
  teacher can force A or B.
- Result page: Halil Bey's sheet as a screen: points per section, writing and speaking criteria with the AI's
  proposal (point pickers 0-3 / 0-4), writing: word count, Leitpunkt check, error list, the sheet's "Häufigste
  Fehler" boxes pre-ticked by the AI; outcome, band and next course; confirm, override with reason, finalize,
  release.
- Printed teacher report: German only (owner rule), laid out like the Bewertungsbogen: header (Campus German
  school name from org, test name, form, name, date, teacher), section table, writing and speaking criteria,
  Gesamtauswertung, Einstufung, signature lines "Unterschrift Lehrkraft" and "Gesehen (Teilnehmer/in)".
- Student: no score or right/wrong during the test. After release, in the student's language: Bestanden / Nicht
  bestanden (translated), points per section, next course, missed topics (from skill tags via `topics.ts`),
  never the questions.

## Engine (approach A)

- `EXAM_MODES` gets `COURSE_TEST` (migration 0029: `exam_mode` and `ai_purpose` `COURSE_RUBRIC` values, columns
  below). Every switch on the mode handles it; a course test has no claimed level.
- `BlueprintConfig.course?: { key: CourseKey; form: "A" | "B" | null; rules: CourseRules }`. Sections all fixed
  (`adaptive: false`). The invite writes the form into the assessment's snapshot.
- Forms are stored on the rows: `items.course_form` (e.g. `B1:A`), `items.course_order`, `stimuli.course_form`.
  A course section's plan is the form's items of that section ordered by `course_order`. Every random draw, bank
  coverage, generation dedupe and the bank screen ignore rows with a `course_form` (the two never mix).
- Seed: `src/db/seed-bank/course-tests/{a1,a2,b1,b2}.ts`, one `SeedCourseForm` per form; `bank:topup` loads them
  (seed key includes the form). Listening scripts go through the lock and `bank:tts` like the bank's.
- Templates: one per course test key, published on first invite (`ensureTemplateBlueprint`).
- Cloze gaps may have 3 options (a/b/c) as well as 4.
- Result: a pure `course-result.ts`; `ComputedResult.course` carries sections, total, outcome, reasons,
  recommendation. Grading: new purpose `COURSE_RUBRIC`, German prompt and schema built from Halil Bey's prompt.

## Content

- B1 FINAL form A: Halil Bey's written test word for word (Lesen, Sprachbausteine, Schreiben), plus new Hören and
  speaking tasks built from his oral cards (2A, 2B and the planning card 3, the last as a monologue). B1 FINAL B and
  every other form: new, in the same format, at the course's syllabus.
- Syllabus per course from Klett's Netzwerk neu tables of contents (chapter themes, grammar, communication goals);
  each form file names the source URL. B2 from the CEFR B2 grammar and theme list (Goethe/telc B2).
- Every form: blind-solve review (an Opus reviewer solves without the key), the bank quality tests, the listening
  lock, topics for every skill tag.

## Testing and rollout

Unit tests for the rules and bands, the form plan, A/B assignment, pool exclusion, migration; rubric grading on
a few local calibration texts with the real model if the key works; a Chrome tour on a review server (invite,
student run of B1 FINAL with a speaking task, teacher grading, German report). One deploy at the end: backup,
migration, bank top-up with course forms, TTS, STATUS log.

## Questions the lead answered (owner may overrule)

1. Version B written and version A oral: not received; written by us.
2. INTERIM pass mark 60%: lead's choice (common university language centre rule), not Halil Bey's.
3. A1 and A2 split 6+6 like B1: assumed from Netzwerk neu's two Teilbände per level.
4. Speaking points over several tasks: floor of the mean task total.
5. FINAL failed only by the speaking minimum or INHALT 0: L.2 with a focus flag (Halil Bey's sheet says this for
   speaking; the lead applies the same to writing).
