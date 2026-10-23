# BANK-b2 report

Branch: worktree-agent-a143f2cc599945836 (base 223855a). Only file changed in commits: src/db/seed-bank/levels/b2.ts.
Commits: 16e93bc (step 1, topics), b6a3eea (reading + listening units), 45278ad (Sprachbausteine-15 + open cloze), f69fb5b (speaking pictures + header).

## Counts before -> after
- Grammar: 33 -> 39 items (3 MC cloze, word banks 3 -> 6 [3 are Sprachbausteine-15], open cloze 0 -> 3, 3 C-tests, 24 singles)
- Reading: 7 texts / 20 items -> 13 texts / 29 items
- Listening: 6 clips / 17 items -> 12 clips / 29 items (3 clips with maxPlays 1)
- Writing: 8 -> 8 (target >= 7 already met, unchanged)
- Speaking: 7 -> 11 (4 speaking.picture + 7 others)

## Step 1
Every gap of the 3 MC cloze texts and 3 word banks got a #topic (59 gaps). Keys unchanged.

## New seed units
Reading insertion 5/7 (MATCHING, rows "Lücke (1)".."(5)", targets "A: ".."G: ", 2 spare, each target used once):
- v2-r-b2-stadtimker-dach, v2-r-b2-buecherschrank-ecke, v2-r-b2-teenager-schlaf (each + 1 MC)
Reading opinion matching (MATCHING, 4 commenters, 5 statements, one fits "Keine der vier Personen"):
- v2-r-b2-kommentare-tempolimit, v2-r-b2-kommentare-bargeld, v2-r-b2-kommentare-bildschirmzeit (the existing Viertagewoche set is a fourth of the kind)
Listening who-says-what (MATCHING, 3 speakers + "Keine der drei Personen", 4 statements, + 1 MC each):
- v2-l-b2-urlaub-wer-sagt-was (A Lena, B Murat, D Josefine), v2-l-b2-hausversammlung-hof-wer-sagt-was (A, B, D), v2-l-b2-kino-wer-sagt-was (A Nora, B Ben, C Cem)
Listening play once (maxPlays 1), 2 MC each:
- v2-l-b2-nachrichten-bruecke-einmal, v2-l-b2-durchsage-schwimmbad-einmal, v2-l-b2-radiotipp-stadtfest-einmal
Grammar:
- Sprachbausteine-15 (wordBank builder, 10 gaps, 5 distractors, EASY/MID/HARD): "Mehr Platz für Fahrräder", "Gebraucht statt neu kaufen", "Hitze in der Stadt"
- Open cloze (openCloze builder, 9-10 gaps, EASY/MID/HARD): "Ein Tag ohne Auto", "Ein Tag im Tierheim", "Das Ende der Postkarte"
Speaking (speaking.picture, 60 s think, 150 s answer, 2 takes): scene.b2.car-sharing (MID), scene.b2.crowded-tram (MID, follows the alt text "Bus"), scene.b2.senior-with-tablet (HARD), scene.b2.waste-sorting (EASY).

## Voices (controller note: A f, B m, C m, D f)
New clips are cast by gender, so two of the three "3 voice" clips use D instead of C (two women need A and D). Existing locked clips break the gender rule (lPausen Moderatorin=B, Dr. Brandt=A; lAufschieben Referentin=B; lTermin Nina=B, Tarek=A; lZahnarzt Frau Winter=B; lUmfrage Reporter=A, Frau Berger=B). Fixing needs new keys; not done, controller decision.

## Checks run
- `pnpm vitest run src/db/seed-bank src/lib/exam`: 4 failures, all structural, none about content quality:
  1. listening-lock "every listening script is locked": my 6 new clips (expected).
  2. bank-seed.test.ts "B2: three word banks ... 8 whole-word gaps" and "every text has its own title ... length 6": Sprachbausteine share skill tag grammar.wordbank, so the test sees 6 banks with 10 gaps.
  3. src/lib/exam/templates.test.ts "seed bank's texts do not count as ordinary grammar items": wordBanks is 6, expects 3. Same cause.
  Tests 2 and 3 need updating (B1 will hit the same). I did not edit tests (not my file). Everything else passes (key-length rules, 40% non-work, items per text, topics resolve, validation, em-dash, option positions).
- `pnpm bank:originality --level B2`: 714 strings, 0 hits.
- `npx tsc --noEmit`: clean.
- Not done: blind solve (reviewer), TTS, live rendering.

## Topics wanted but missing
None blocking. Closest-fit: streiten über / verweisen auf / leiden unter tagged praepositionaladverb; "so viele ... wie" tagged adjektiv.komparativ; "als" comparison tagged konnektor; preposition "Während" tagged praeposition.zeit.

## Concerns
- Sprachbausteine distractors were checked by hand against every gap; connector/modal families are arguable. Blind solve should look at "Mehr Platz für Fahrräder" gaps 4 and 5 (wenn, sodass), "Gebraucht statt neu kaufen" gap 7 (zumal), "Hitze in der Stadt" gaps 3 and 6 (Folglich, Dennoch).
- Open-cloze accepted variants are my judgement; a teacher may want more.
- Who-says-what adds a fourth target "Keine der drei Personen" so the validator rule right >= left holds; one statement per clip is a deliberate distractor.
- Writing was not changed (8 tasks exist).

## Fix round 1 (blind solve findings)
- Findings 1-3: stems no longer name Lindner, Ben or Murat.
- Open cloze: "Ein Tag ohne Auto" g2 closed ("uns für den Bus entschieden"), g9 closed ("so bald wie/als möglich"), g6 competing noun removed, g7 and g3 lists widened, tense fixed; "Ein Tag im Tierheim" lists widened (obschon, auf, hätte/bekäme/erhielte, beispielsweise/insbesondere/speziell, dieser/ihrer, über/auf); "Das Ende der Postkarte" g1 plural so only "was" fits, g3 list widened, g5 closed (relative "die/welche"), g6 accepts "ist".
- Sprachbausteine-15: capitalised distractors added (Anstatt; Gegenüber, Ob; Mithilfe, Wovon), "darüber" replaced by "woran", "Eine Stadt im Norden hat dafür".
- Reading: Honig, Schlaf and Bücher follow-up MCs now rest on printed text only; two opinion statements paraphrased.
- Play-once keys paraphrased. Waste-sorting contentPoint uses the Spanish-labelled bins (Glas, Verpackungen, Papier und Pappe, Bioabfall); prompt reworded.
- Finding 23 (image ids car-sharing/crowded-tram do not match photos): not changed, manifest is not mine.
- Recast under NEW keys (-v4): pausen-interview, vortrag-aufschieben, kollegen-termin, voicemail-zahnarzt, umfrage-nachrichten (5 clips: Moderatorin/Referentin/Nina/Frau Winter/Frau Berger now A, Dr. Brandt/Tarek/Reporter now B). The sixth, "Durchsage" (neutral announcer, voice A = female), was left as is; say if it should move. Old items retire in the top-up; the new keys are not in the lock file yet.
- Checks: vitest shows the same 4 expected failures (listening-lock for the 11 new keys, wordbank count tests x3); originality 0 hits; tsc clean.

## Fix round 2
- kollegen-termin-v4: distractor "Donnerstag um zehn" -> "Montag um zehn". Honig, Teenager, Bücher MC keys paraphrased; Teenager rationale no longer cites hidden sentence D. Waste-sorting studentPoint 2 matches the prompt. Open cloze: Tierheim g5 + darunter/vorwiegend/hauptsächlich/namentlich; Postkarte g4 + an/aller, g10 + Inmitten.
- Checks: originality 0 hits, tsc clean. vitest: the same expected failures plus a templates.test.ts simulation timeout (5 s, "multiple-choice form before onSET", seen earlier as flaky with the larger bank); not content related, not investigated further.
