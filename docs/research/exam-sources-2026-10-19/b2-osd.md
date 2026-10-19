# B2 / ÖSD findings for the Kademe bank

Sources: "ZB2 Homepage MS.txt" (full Modellsatz, clean text) and "Das_Testbuch_SD_B2_Prfung.txt" (prep book, about 10 Modelltests in the same older format). Much of the book's OCR is upside-down garbage (answer sheets, many transcripts), so I used it only for structure, task rubrics, one listening transcript and scoring grids. Anything beyond that is [unverified]. The format below is the older ÖSD B2 model; whether the current official format differs is [unverified]. All examples are original.

## 1. Source inventory

| Part | Task type | Items / pts | Answer format |
|---|---|---|---|
| Lesen 1 | one magazine feature (~600 words) with quoted experts, 3-option MC | 5 items, 5 pts, plus example | A/B/C; item order does not follow text order |
| Lesen 2 | 10 headlines vs 5 short news items (~90-100 words each) | 5 items, 5 pts | letter A-K; extra headlines are topical neighbours; a letter may be reused |
| Lesen 3 | cut-off article (~200 words), 20 word endings (max 3 letters) lost at the right margin | 20 gaps, 5 pts | typed; sensible variants accepted; explicit spelling tolerance |
| Lesen 4 | open cloze in a promotional letter (~200 words) | 10 gaps, 5 pts | one word, function words (pronouns, prepositions, connectors); several keys have 2 accepted answers |
| Hören 1 | radio programme in 4 labelled sections, R/F | 10 items, 10 pts | 90 s read time, played twice. Blank or both ticked = 0 for the item; all R or all F = 0 for the whole task |
| Hören 2 | dialogue with an information table (numbers, times, ticks) | ~30 cells, 45 measurement points | played once; multi-tick rows get partial credit |
| Schreiben 1 | complaint e-mail built on an ad plus margin notes | 15 pts | ~120 words, every note covered, salutation and closing required |
| Schreiben 2 | choose A or B: react to 3-4 statements or headlines | 15 pts | ~120 words, 4 points: opinion, reasons, own experience, situation in your country |
| Sprechen | 15 min prep, then 3 tasks of ~5 min | 30 pts | 1 meet a stranger on a train, then a topic and tips; 2 pick 1 of 3 photos, justify, describe, interpret, speculate; 3 opinion exchange in an assigned role, adding new arguments |

Timing: Lesen 90 min, Hören about 30 min, Schreiben 90 min. Scoring: Lesen 20 and Hören 20, each with a minimum of 7 to pass the written exam. Speaking: per task 3 pts for interaction, plus 7 each for expression, intelligibility/fluency and formal correctness.

Book listening transcript (Modelltest 10): the radio text has about 150-250 words per section, one reader, with statistics, a case person quote and an expert remark. The dialogue is a tourist-office talk: the clerk offers three options with days, times and durations, and the customer's changing wishes steer the fit.

## 2. Item-writing patterns worth adopting

1. **Text types and topics.** Authentic-looking press and promotional prose (feature with expert quotes, short news items, brochure letter). Topics are broad and social: clothing and image, obesity, women in technical jobs, libraries, sport, au pairs, city tours, marriage vs singles, shopping, reading, media use, language learning. Work is one theme of many.
2. **Distractors are semantic neighbours.** Wrong MC options state something true of another person or topic, or inflate a local fact into a general one. Extra headlines share a topic (two on obesity, two on women's careers) so keyword spotting fails.
3. **Paraphrase distance.** Keys are generalisations or synonyms ("a low price"), stems repeat the text's noun, keys do not.
4. **Opinion vs fact.** Lesen 1 asks what the expert believes vs what the article reports. Hören R/F statements often turn on one qualifier ("mainly", "everyone", "first of all").
5. **Language is tested in text.** B2 grammar appears as reconstruction and open cloze in coherent genre texts, never as isolated sentence MC.
6. **Listening.** Sections and statement order follow the audio, which is a map for the listener. Keys are hidden by a changed number or plan, and by constraints that eliminate options. The anti-guess rule (all R / all F = 0) removes pattern guessing. Hören 2 is dense with numbers, days and prices.
7. **Writing.** A situation with a real stimulus, 4 mandatory bullets, about 120 words, a register cue. Opinion tasks always add own experience and a cross-country comparison.
8. **Speaking.** Prep time, then social talk, then picture description with speculation, then role-based debate where you must bring new arguments, not just agree.

## 3. Bank audit (src/db/seed-bank/levels/b2.ts, 73 items; counts computed by running the module with tsx)

| Section | Types | Count |
|---|---|---|
| GRAMMAR 33 | SINGLE_CHOICE 18; GAP_FILL 15 (3 C-tests, 3 MC cloze, 3 word banks, 6 single-gap of which 3 typed: b2.ts:147, 191, 212) | 33 |
| READING 16 | SINGLE_CHOICE 9, TRUE_FALSE_NG 4, MATCHING 3 (statements-to-person, sentence-to-gap, headline-to-section) | 16 |
| LISTENING 12 | SINGLE_CHOICE 9, TRUE_FALSE_NG 3 | 12 |
| WRITING 6 | WRITING_PROMPT: opinion 3, semiformal 2, formal 1 | 6 |
| SPEAKING 6 | presentation 2, discussion 2, description 1, message 1 | 6 |

Reading skillTags: detail 7 (3 SC + 4 TFNG), gist 3, inference 3, vocabulary 2, structure 1. Listening: detail 9 (6 SC + 3 TFNG), gist 1, attitude 1, inference 1. Grammar: 14 inventory points with 1-2 items each. Stimuli: 4 reading texts (182, 232, 383, 402 words), 3 listening clips (236, 377, 454 words).

Blueprint gaps vs ÖSD B2: no typed open cloze of function words; no truncated-ending variant; no headline-to-short-text set; no table-completion or R/F-by-section listening; no picture task and no assigned-role debate; writing has no stimulus-based complaint and no "situation in your country" point; all reading, listening, writing and speaking material is about work or learning.

Weaknesses (each verified by reading the line; the numeric ones by running code):
1. **Key is never option d.** All 36 four-option items key a/b/c only (6/6/6 grammar, 3/3/3 reading, 3/3/3 listening). The header comment (b2.ts:20-22) calls d an "extra wrong distractor", so each item is effectively 3-option.
2. **Longest-option giveaway.** In the 18 non-grammar MC items the key is the longest option in 13 (72%, chance about 25%): b2.ts:473, 527, 536, 587, 595, 652, 661, 764, 821, 830, 877, 886, 897.
3. **Word matching solves items.** b2.ts:527 (key echoes "Technik" from the source sentence), b2.ts:587 (key echoes "Arbeitszeiten ... unterschiedlich"), b2.ts:637-650 (headings are near-verbatim section keywords: Besprechungsräume, Küche, Zugang).
4. **NG is predictable.** NG is the last statement in 6 of 7 sets (b2.ts:489, 604, 673, 777, 843, 893; b2.ts:547 is 2nd of 4) and is always an invented detail about a person or organisation (who built the app, Sabine's attendance). ÖSD B2 uses R/F only.
5. **Difficulty labels.** b2.ts:838 (lecture R/F/NG, HARD) is solvable by matching "Schritte" and "sofort"; b2.ts:461 (HARD) paraphrases cleanly but each statement has one obvious person.
6. **Grammar EASY at B1.** Past passive (b2.ts:108), wegen + Genitiv (b2.ts:135-136) and je...desto are B1 content. b2.ts:112: the singular "Büro" makes the plural distractor "sind" fall out by agreement. b2.ts:136: "Obwohl/Weil" are eliminated by syntax because a noun phrase follows.
7. **Possible second key.** b2.ts:170-171: "anstatt des Gebäudes ... im Garten" reads as acceptable ("instead of in the building, in the garden") although the explanation calls it nonsensical. [needs native check]
8. **Metalinguistic items.** b2.ts:124 (name the Konjunktiv I form) and b2.ts:175 (what does "doch" express) test terminology and a prompt cue, not use. Also in b2.ts:124 "käme" is common in real reported speech and only the instruction line rules it out.
9. **Listening reads like prose.** The lecture (b2.ts:800-806) has 100+-word turns, perfect syntax and explicit signposting; the interview's expert turns (b2.ts:726+) run 60-90 words with almost no repair; only the conversation (b2.ts:850+) sounds spoken and uses a first-plan-then-revision trick that works.
10. **Text level.** The carpool text (182 words, b2.ts:556-570) and the coworking rules (b2.ts:616-635) are B1 in length and syntax; ÖSD B2 texts are about 500-600 words.
11. **Gap-sentence distractors.** b2.ts:577 (everyone cycles now) contradicts the "Trotzdem" that follows, b2.ts:581 (app costs) fits no gap. Good extra sentences fit two gaps topically and fail only on a cohesion clue.
12. **Topic monoculture and missing comparison point.** All 6 writing and 6 speaking prompts (b2.ts:949-1200) are about work or learning, none asks to compare with the learner's country.

## 4. Top 10 recommendations (existing item types only)

1. **Rotate the key through d** (about 25%) for all MC and re-run the key-position check. Cheapest fix for the largest shortcut.
2. **Equalise option length**: the key longest in about 25% of items, wrong options as concrete as the key (the 13 items above).
3. **Add a typed open cloze** (GAP_FILL, no choices): 8-10 function-word gaps in a coherent text, answer lists with variants. Original gap: "Er hat sich ___ die Stelle beworben, ___ er kaum Erfahrung hatte." (um/auf; obwohl/auch wenn).
4. **Add headline matching** (MATCHING): 5 short items, 7 headlines, extras that share one word with a wrong item. Original headline: "Mehr Haushalte teilen sich ein Auto" for an item about neighbours using one shared car; a nearby extra: "Autokäufer wählen größere Modelle".
5. **Broaden topics** to at least 5 non-work themes (health, housing, media, family forms, sport, language learning, shopping, environment) in every section.
6. **Rewrite listening for speech**: turns of 20-50 words, one self-correction or changed number per clip, key hinging on qualifiers ("meistens", "nur teilweise"). Add a number/time info-exchange clip with GAP_FILL or SHORT_TEXT answers. Keep clips at 250-350 words.
7. **Fix R/F/NG**: vary the NG position, make NG a plausible extension the speaker could have said, and make F differ from the text by one qualifier ("alle" vs "viele"). Add a plain R/F set per clip with no NG.
8. **Add 450-550 word feature texts with two named voices who disagree**, and tag items opinion vs fact. Keys paraphrase; they never reuse the source noun.
9. **Add stimulus-based productive tasks**: a complaint e-mail built on a short ad plus three notes inside the prompt text; an opinion task on 3 headlines with the mandatory points "own experience" and "situation in your country". For speaking, a role-assigned debate where a stance is given and the learner must add a new argument, and a described-photo task ("A photo shows two people at a laptop in a library: describe, interpret, speculate"). Image support in SPEAKING_PROMPT is [unverified].
10. **Re-level grammar**: move the B1 items (b2.ts:108, 135-136, je...desto) down or replace them with B2 entry points (Funktionsverbgefüge, Partizipialattribut, "es sei denn", nominalisation), drop the two metalinguistic items, and write every stem as a short realistic context.
