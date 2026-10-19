# TestDaF findings for the Kademe B2/C1 bank

Sources read: Musterprüfung 5 (OCR), Cornelsen "Prüfungstraining TestDaF" (2008), Klett "Mit Erfolg zum TestDaF" (2009). No passage or item wording is reproduced. All bank counts below come from a script run against the seed files (read-only), plus line reads.
Caveat: both books describe the pre-2024 paper format. Whether the current digital TestDaF changed it is not in the sources [unverified]. The Musterprüfung OCR garbles numbers (it prints "5 Lesetexte, 50 Aufgaben" and "50 Minuten" speaking); the printed item numbers and Cornelsen's tables show 3 texts / 30 items and about 30-35 minutes, and I used those. The answer grids in the Musterprüfung are unreadable, so I did not rely on its keys.

## 1. Source inventory

| Part | Time | Tasks | Items | Answer format |
|---|---|---|---|---|
| Leseverstehen | 60 min (10 of them for transferring answers) | T1 eight short texts (300-450 words total), study-related, ~10 min; T2 journalistic science text (450-600 words), ~20 min; T3 academic journal text (550-650 words), ~20 min | 10 + 10 + 10 = 30, 1 point each | T1 match needs to texts A-H, letter "I" if none fits (Cornelsen: 3 of 10 have no match); T2 3-option MC, last item asks the main message; T3 Ja / Nein / Text sagt dazu nichts |
| Hörverstehen | ~30 min audio + 10 min transfer | H1 dialogue between students or student and staff, 350-400 words, heard once; H2 interview or round with 2-4 speakers, 550-580 words, heard once; H3 lecture or expert interview, 580-620 words, heard twice | 8 + 10 + 7 = 25 | H1 short notes to W-questions; H2 Richtig / Falsch only (no NG); H3 short answers, some questions limit the answer ("name two reasons") |
| Schriftlicher Ausdruck | 60 min (+5 to read instructions) | one task: describe and compare a table or chart (~20 min), then argue a question or two opposing statements (~40 min), include the home-country situation | 1 text, no word count given | free text, rated on Gesamteindruck, Umsetzung der Aufgabe, Sprachliche Realisierung; comprehensibility counts more than correctness |
| Mündlicher Ausdruck | ~30-35 min, tape-controlled | 7 situations: phone inquiry, report from home country, describe a chart, take a stand with pros/cons, advise between two options, build hypotheses from a chart, give advice | 7 | prep 30 s to 3 min, speaking 30 s to 2 min; formal and informal registers mixed; an audio interlocutor speaks after the prep time |

Scoring: TDN 3, 4, 5 per skill (B2.1 to C1.2); below TDN 3 is "not reached"; TDN 4 in every part is the usual admission bar. Cut-offs vary per test set: reading TDN 5 needs 24-26 of 30, TDN 4 needs 20-22, TDN 3 needs 14-16. Listening needs 19-21, 15-17 and 10-12 of 25. Task difficulty is fixed by position: Reading T1/T2/T3 = TDN 3/4/5, Listening H1/H2/H3 = 3/4/5, Speaking tasks 1,2,7 = 3; 3,5 = 4; 4,6 = 5. All topics are academic: study life, science, media, environment, society.

## 2. Item-writing patterns worth adopting

**Ja / Nein / Text sagt dazu nichts (our R/F/NG).**
- Klett defines the two non-Ja answers precisely. Nein: the item's topic is in the text but the claim differs from it. NG: the topic occurs, but the claimed information is neither stated nor implied. So an NG statement always hangs on something the text really discusses.
- Cornelsen's worked examples show how NG is built. The item adds a cause the text does not give (the text gives a consequence instead). It asserts a result for a person (the researcher "discovered" what the text says she "observes"). Or it adds a comparison the text never makes. Ja/Nein statements restate a text sentence with synonyms.
- How Nein is built: a negated or absolute claim against a stated fact ("not yet managed" against "ten identified so far"); a scope change ("overall" against "in the lower part"); a role inversion (X steers Y against Y is a function of X); "allein" against "nur teilweise"; an "undenkbar" against "wahrscheinlich" hedge.
- Rules the books state: items follow text order; the answer must come from the text, not from whether the claim is true in the world; a missing synonym for a key word is a hint toward Nein/NG; two example items (01) one NG, (02) one Nein precede the scored ones.
- Hedge pairs (zwar ... aber, bisher, noch nicht, nur teilweise) are where the books locate the Nein/NG decision, in the Klett commentary.

**Matching (Lesetext 1).** In Musterprüfung 5, ten needs map to eight short web-site descriptions. Needs combine two or three constraints (language, period, purpose, user type) and the texts overlap on one constraint (two French sites, two Italian ones, two for Romance-studies students). Only the second constraint decides. Needs paraphrase, never copy, the offer. An example is worked in the book to show a synonym match ("refresh grammar" = "Wiederholung") and a clean no-match (no course for the requested language). Texts are used once; about three needs have no text.

**Academic listening.** Interview and lecture answers are reworded. The interviewer's question is not the item wording. In the Musterprüfung interview, a speaker says he first felt overwhelmed and later managed; the item tests the later state. Another speaker gives advice to inform oneself; a distractor item credits him with criticising students (a stance he never takes). One speaker names two job-finding routes, and the item asks for the one the interviewee actually used. Numbers appear as restated amounts. Cornelsen adds: items follow audio order, an item may be answered by a short aside, and in the lecture the question structure differs from the speech structure (a "compare" question is answered by two separate statements).

**Writing.** Short context text, a table (4 years x 5 categories), then guiding points: describe, compare, name changes; then two to three argumentation questions with "pros and cons", "give reasons" and "your home country". Cornelsen's variant gives two opposing statements: restate them in own words, take a position on both, justify. Time split is stated (20 / 40 min).

**Speaking.** Every task has the same two-part layout: a printed situation with explicit bullet obligations, then a prep time, then an audio partner prompt, then speaking time. Registers change (a lecturer, a friend, a seminar). Chart tasks ask first to explain how the chart is built, then to summarise; the TDN 5 chart task asks for reasons and measures. Both books teach "say what you thought; stopping early is fine".

**Traps the books name:** copying the first matching word; ignoring "zwar ... aber"; confusing "text does not say" with "I disagree"; stopping at the first synonym instead of checking the logical connector; answering from background knowledge.

## 3. Bank audit (b2.ts, c1.ts)

Counts (script): B2 has 7 TRUE_FALSE_NG items (25 statements: 10 R, 8 F, 7 NG), 3 MATCHING, 12 LISTENING items (9 SINGLE_CHOICE, 3 TFNG, 0 MATCHING, 0 SHORT_TEXT). C1 has 5 TFNG items (15 statements: 5 R, 5 F, 5 NG), 3 MATCHING (2 reading, 1 listening), 12 LISTENING items (10 choice, 1 TFNG, 1 MATCHING).

**Structural weaknesses (verified by script and line reads)**
1. Every TFNG item has exactly one NG statement, and it is last in 11 of 12 items (only microlearning, b2.ts:547, is second). The first statement is R in 10 of 12 items. A test-wise candidate can predict the key.
2. The correct option is the longest in 26 of 38 SINGLE_CHOICE items in the four reading/listening blocks (B2 reading 7/9, B2 listening 6/9, C1 reading 8/10, C1 listening 5/10).
3. F statements carry absolute words more often than R ones: "problemlos" b2.ts:488, "nur ... einzigen" b2.ts:601, "keine zusätzlichen" c1.ts:555, "immer" c1.ts:629. 4 of 13 F against 2 of 15 R.
4. Texts are shorter than TestDaF's: B2 reading 182-402 words, B2 listening 236-454; C1 reading 356-546, C1 listening 392-524. TestDaF's top-level texts are 550-650 (reading) and 580-620 (listening); only c1 pausen/queren-einstieg come close.
5. No table/chart description (writing or speaking), no SHORT_TEXT listening. SPEAKING times at C1 (240/300 s talk, 120/180 s discussion, c1.ts:1040-1041) are well above TestDaF's maximum of 180 s prep and 120 s speaking.

**Statement-level problems**
- NG about the speaker's private life, answerable only by guessing: b2.ts:777 (the expert works from home), c1.ts:630 (the consultant once worked in HR). They test no text content.
- NG that invites a real-world prior: b2.ts:673 (are phone booths charged), c1.ts:822 (most companies already have rules).
- NG/F overlap: b2.ts:604 says "Die meisten" pay a subsidy, while the text says "manche" companies reserve parking; a candidate can reasonably answer F on the quantifier. c1.ts:556 (repair shops plan to hire) sits next to a text that says they lack trainees; F is arguable.
- "F" that is really "unknown": c1.ts:522 (fixed breaks proved effective). The text says long-term studies are missing, which is closer to Klett's NG-with-explicit-doubt pattern than to a contradiction. c1.ts:820 ("genügt meistens" against "nur bedingt") differs only by a hedge. I rate both borderline [judgement].
- F by single-word antonym swap, so easy: b2.ts:548 (Freizeit/Arbeitszeit), b2.ts:601 (einer/mehrerer Firmen), b2.ts:841 (später/sofort). No F uses scope, role or cause changes.
- Near-verbatim R statements (giveaway matching): b2.ts:546 ("behält ... länger"), b2.ts:549 ("am erfolgreichsten", "Treffen vor Ort"), b2.ts:775 (Handy, Nachrichten lesen), c1.ts:521 (the sentence about slower return to full performance, tagged "inference/HARD").
- Matching giveaways: b2.ts:643-644 headings repeat the section's own noun ("Küche", "Zugang", "Besprechungsräume"); b2.ts:464 "wünscht sich" echoes "Ich wünsche mir"; c1.ts:602-604 each matched statement shares a noun with its text ("Bewerbungen/Vorauswahl", "Bewerbende", "Schlagwörter"), and the no-match statement is the only extreme one ("gesetzlich verboten", c1.ts:605). c1.ts:841 does the same for "keiner von beiden" ("grundsätzlich nicht").
- Sentence-insertion distractors are eliminable by stance only: b2.ts:573-580 (cycling answer contradicts "Trotzdem"), c1.ts:565 and c1.ts:569 (contradict the author's argument) rather than competing on cohesion.
- Well built, to keep: b2.ts:547 and c1.ts:594 (plausible NG on a present topic), b2.ts:672 (key by rewording, F), listening matching c1.ts:835-842 apart from statement 4, and the day-switching trap in the b2 Termin clip.

## 4. Top 10 recommendations

1. **Adopt Klett's NG/Nein definition in the item-writing guide.** NG = topic present, requested detail absent; Nein = detail conflicts. Ban speaker-biography and world-prior NG. Original example. Text: "Die Bibliothek öffnet seit April zwei Stunden länger, weil viele abends lernen wollten." NG: "Die Besucherzahl ist dadurch gestiegen." Nein: "Der Grund war ein neues Sicherheitskonzept." R: "Seit dem Frühjahr kann man abends länger lernen."
2. **Randomise the TFNG layout.** Allow 0-3 NG per item, 4-6 statements, NG anywhere, and check the position distribution of keys in a unit test.
3. **Widen the F repertoire:** quantity/scope change, role inversion, cause reversal, hedge flip ("noch nicht" against "bisher"). Use at most one pure antonym swap per item. Example: text says a method works "only partly"; F: "Die Methode erklärt den Effekt vollständig."
4. **Add a paraphrase lint:** an R statement may not reuse the longest noun phrase of its source sentence. Rewrite the lines listed in section 3.
5. **Two-constraint matching.** 6-8 needs, 8 texts, 2-3 needs with no text, two texts that fit on the first constraint. Example need: "Ein Kollege möchte abends Tabellenkalkulation lernen, kann aber nur online teilnehmen." Texts: A Excel abends, vor Ort; B Excel online, vormittags; C Tabellenkalkulation online, abends. Answer C, by synonym plus both constraints.
6. **Listening: add SHORT_TEXT (note) items** with `accepted` keyword lists (grade by meaning, not spelling), question words, and one "name two" item per lecture. Keep R/F statements in audio order, and add "revision inside a turn" and "stance never taken" traps. Decide that B2 listening uses R/F only (TestDaF does), and keep NG for C1 lectures. This is my suggestion, not in the sources.
7. **Lengthen C1 texts** to 550-620 words (reading and listening) with 7-10 statements per text, and end each MC set with a main-message item. Keep the TestDaF ladder: matching first, MC second, R/F/NG last, mapped to EASY/MID/HARD.
8. **Writing: a two-part prompt with a plain-text table in the prompt** (describe and compare, then argue, then home country). Rubric by Gesamteindruck, Umsetzung, Sprachliche Realisierung, with a note that comprehensibility beats correctness. Original: a 4x3 table of weekly study hours per faculty, plus "Soll Anwesenheit Pflicht sein?" [text-table rendering in the prompt box is unverified].
9. **Speaking: shorter, situational tasks** at 30-180 s prep and 30-120 s speaking. Include an advice task to a friend (informal), a task to a lecturer (formal), and a chart task with "first explain the layout". Shorten c1.ts:1040-1041.
10. **Even out option length** in SINGLE_CHOICE items (correct option longest in 68% of the sample) and add a unit test for it beside the existing seed tests.

Not verified: how the app renders tables in prompts, whether SHORT_TEXT can be graded by multi-keyword lists in the current scorer, and any item keys from the Musterprüfung.
