# Grading calibration: round-1

Date 2026-10-25, provider gemini, model gemini-3.6-flash, 3 runs per fixture, 85 fixtures, temperature default, seed none, 1 model answer per run (median).

Goals (exact >= 70%, within one >= 95%, every A0 fixture A0 in every run, nothing above the task cap, repeated runs agree >= 90%): **not met (repeated runs agree below 90%)**.

## Summary

- fixtures 85, runs 255, graded 255, unparseable 0, errors 0
- exact 75.7%, within one 99.2%; on the 71 fixtures a blind rater also holds: exact 82.6%, within one 99.1%
- repeated runs agree: pairwise 86.7%, fixtures with all runs equal 80.0%
- A0 fixtures 17, not A0 in every run: 0
- above the task cap: final 0, raw model 0
- mean signed bias by target level: A0 +0 (51 runs), A1 +0.26 (39 runs), A2 +0.26 (57 runs), B1 +0.1 (39 runs), B2 +0.44 (45 runs), C1 +0.43 (21 runs), C2 +0 (3 runs)
- flag OFF_TOPIC: precision 100.0%, recall 100.0% (tp 12, fp 0, fn 0)
- flag TOO_SHORT: precision 100.0%, recall 100.0% (tp 9, fp 0, fn 0)
- flag NOT_GERMAN: precision 100.0%, recall 100.0% (tp 18, fp 0, fn 0)
- flag EMPTY: precision 100.0%, recall 100.0% (tp 6, fp 0, fn 0)
- flag COPIED_TASK: precision 100.0%, recall 100.0% (tp 21, fp 0, fn 0)
- diagnostics: {"LEVEL_CAPPED":0,"A0_RAISED":1,"EVIDENCE_UNVERIFIED":12}

## Confusion matrix (rows: target level, columns: proposed level, all runs)

| target \ proposed | A0 | A1 | A2 | B1 | B2 | C1 | C2 | none |
|---|---|---|---|---|---|---|---|---|
| A0 | 51 | . | . | . | . | . | . | . |
| A1 | . | 29 | 10 | . | . | . | . | . |
| A2 | . | 3 | 36 | 18 | . | . | . | . |
| B1 | . | . | . | 35 | 4 | . | . | . |
| B2 | . | . | . | . | 27 | 16 | 2 | . |
| C1 | . | . | . | . | . | 12 | 9 | . |
| C2 | . | . | . | . | . | . | 3 | . |

## Per fixture

| fixture | kind | target | runs: final level, [raw model level] | flags seen | |
|---|---|---|---|---|---|
| w-a1-tim/blank | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | EMPTY |  |
| w-a1-tim/turkish | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | NOT_GERMAN |  |
| w-a1-tim/words-only | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | TOO_SHORT |  |
| w-a1-tim/task-copied | TRAP/TASK_COPIED | A0 | A0 (rule), A0 (rule), A0 (rule) | COPIED_TASK |  |
| w-a1-tim/a1-clean | LEVEL | A1 | A1, A2, A2 | - | differs |
| w-a1-tim/a1-errors | LEVEL | A1 | A1, A1, A1 | - |  |
| w-a1-tim/a2 | LEVEL | A2 | A2, A2, A2 | - |  |
| w-a1-tim/over-cap | TRAP/OVER_CAP | A2 | A2, A2, A2 | - |  |
| w-a1-krank/english | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | NOT_GERMAN |  |
| w-a1-krank/memorised-intro | TRAP/MEMORISED_TEMPLATE | A1 | A2, A1, A2 | OFF_TOPIC A0_RAISED | differs |
| w-a1-krank/a1-clean | LEVEL | A1 | A2, A2, A2 | - | differs |
| w-a1-krank/a1-errors | LEVEL | A1 | A1, A1, A1 | - |  |
| w-a1-krank/a2-cap | LEVEL | A2 | A2, A2, A2 | - |  |
| w-a2-umzug/dots-only | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | EMPTY |  |
| w-a2-umzug/a1 | LEVEL | A1 | A1, A1, A1 | - |  |
| w-a2-umzug/a2 | LEVEL | A2 | B1, B1, A2 | - | differs |
| w-a2-umzug/b1-cap | TRAP/OVER_CAP | B1 | B1, B1, B1 | - |  |
| w-a2-heizung/turkish-mixed | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | NOT_GERMAN |  |
| w-a2-heizung/a1 | LEVEL | A1 | A1, A1, A1 | - |  |
| w-a2-heizung/a2 | LEVEL | A2 | A2, A2, A2 | - |  |
| w-a2-heizung/b2-over-cap | TRAP/OVER_CAP | B1 | B1, B1, B1 | - |  |
| w-b1-hanna/task-copied | TRAP/TASK_COPIED | A0 | A0 (rule), A0 (rule), A0 (rule) | COPIED_TASK |  |
| w-b1-hanna/a1-short | LEVEL | A1 | A1, A1, A1 | TOO_SHORT |  |
| w-b1-hanna/a2 | LEVEL | A2 | B1, B1, A2 | - | differs |
| w-b1-hanna/b1 | LEVEL | B1 | B1, B1, B1 | - |  |
| w-b1-hanna/b2 | LEVEL | B2 | B2, B2, B2 | - |  |
| w-b1-hanna/c1-over-cap | TRAP/OVER_CAP | B2 | B2, B2, B2 | - |  |
| w-b1-hanna/long-errors | TRAP/LONG_ERRORS | A2 | B1, B1, B1 | - | differs |
| w-b1-markt/b1 | LEVEL | B1 | B1, B1, B1 | - |  |
| w-b1-markt/memorised-template | TRAP/MEMORISED_TEMPLATE | A2 | A2, A2, A2 | - |  |
| w-b1-markt/off-topic-fluent | TRAP/OFF_TOPIC_FLUENT | B2 | B2, B2, B2 | OFF_TOPIC |  |
| w-b1-markt/short-excellent | TRAP/SHORT_EXCELLENT | B2 | B2, B2, B2 | - |  |
| w-b1-forum/a2 | LEVEL | A2 | A2, A2, A2 | - |  |
| w-b1-forum/b1 | LEVEL | B1 | B2, B1, B1 | - | differs |
| w-b1-forum/b2 | LEVEL | B2 | B2, B2, B2 | - |  |
| w-b1-forum/task-copied | TRAP/TASK_COPIED | A0 | A0 (rule), A0 (rule), A0 (rule) | COPIED_TASK |  |
| w-b1-forum/memorised-template | TRAP/MEMORISED_TEMPLATE | A2 | A2, A1, A2 | - | differs |
| w-b2-homeoffice/english | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | NOT_GERMAN |  |
| w-b2-homeoffice/a2 | LEVEL | A2 | A2, A2, A2 | - |  |
| w-b2-homeoffice/b1 | LEVEL | B1 | B2, B1, B2 | EVIDENCE_UNVERIFIED | differs |
| w-b2-homeoffice/b2 | LEVEL | B2 | C1, C1, C1 | EVIDENCE_UNVERIFIED | differs |
| w-b2-homeoffice/c1 | LEVEL | C1 | C1, C1, C1 | EVIDENCE_UNVERIFIED |  |
| w-b2-homeoffice/memorised-template | TRAP/MEMORISED_TEMPLATE | A2 | A1, A2, A1 | - | differs |
| w-b2-homeoffice/long-errors | TRAP/LONG_ERRORS | A2 | B1, B1, A2 | - | differs |
| w-b2-kurs/task-copied | TRAP/TASK_COPIED | A0 | A0 (rule), A0 (rule), A0 (rule) | COPIED_TASK |  |
| w-b2-kurs/b1 | LEVEL | B1 | B1, B1, B1 | - |  |
| w-b2-kurs/b2 | LEVEL | B2 | C1, C1, B2 | EVIDENCE_UNVERIFIED | differs |
| w-b2-kurs/off-topic-fluent | TRAP/OFF_TOPIC_FLUENT | B2 | B2, B2, B2 | OFF_TOPIC |  |
| w-b2-kurs/c1 | LEVEL | C1 | C1, C1, C1 | EVIDENCE_UNVERIFIED |  |
| w-c1-noten/a1-short | LEVEL | A1 | A1, A1, A1 | TOO_SHORT |  |
| w-c1-noten/b1 | LEVEL | B1 | B1, B1, B1 | - |  |
| w-c1-noten/b2 | LEVEL | B2 | C1, C1, C1 | EVIDENCE_UNVERIFIED | differs |
| w-c1-noten/c1 | LEVEL | C1 | C2, C2, C2 | - | differs |
| w-c1-online/task-copied | TRAP/TASK_COPIED | A0 | A0 (rule), A0 (rule), A0 (rule) | COPIED_TASK |  |
| w-c1-online/b2 | LEVEL | B2 | C1, C1, C1 | EVIDENCE_UNVERIFIED | differs |
| w-c1-online/c1 | LEVEL | C1 | C1, C2, C1 | - | differs |
| w-c2-sievers/notes-pasted | TRAP/TASK_COPIED | A0 | A0 (rule), A0 (rule), A0 (rule) | COPIED_TASK |  |
| w-c2-sievers/a2 | LEVEL | A2 | A2, A2, A2 | - |  |
| w-c2-sievers/b2 | LEVEL | B2 | C1, C2, C2 | - | differs |
| w-c2-sievers/c1 | LEVEL | C1 | C2, C2, C2 | EVIDENCE_UNVERIFIED | differs |
| w-c2-sievers/c2 | LEVEL | C2 | C2, C2, C2 | - |  |
| s-a1-intro/almost-silent | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | EMPTY TOO_SHORT |  |
| s-a1-intro/turkish | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | NOT_GERMAN |  |
| s-a1-intro/task-read-aloud | TRAP/TASK_COPIED | A0 | A0 (rule), A0 (rule), A0 (rule) | COPIED_TASK |  |
| s-a1-intro/a1-clean | LEVEL | A1 | A1, A2, A2 | - | differs |
| s-a1-intro/a1-errors | LEVEL | A1 | A1, A1, A1 | - |  |
| s-a1-intro/a2-cap | LEVEL | A2 | A2, A2, A2 | - |  |
| s-a2-alltag/english | A0 | A0 | A0 (rule), A0 (rule), A0 (rule) | NOT_GERMAN |  |
| s-a2-alltag/a1 | LEVEL | A1 | A1, A2, A1 | - | differs |
| s-a2-alltag/a2 | LEVEL | A2 | B1, B1, B1 | - | differs |
| s-a2-alltag/b1-cap | TRAP/OVER_CAP | B1 | B1, B1, B1 | - |  |
| s-a2-chefin/a1 | LEVEL | A1 | A1, A1, A1 | - |  |
| s-a2-chefin/a2 | LEVEL | A2 | B1, B1, B1 | - | differs |
| s-a2-chefin/b1-cap | TRAP/OVER_CAP | B1 | B1, B1, B1 | - |  |
| s-b1-abschied/a2 | LEVEL | A2 | A2, A2, A2 | - |  |
| s-b1-abschied/b1 | LEVEL | B1 | B2, B1, B1 | - | differs |
| s-b1-abschied/b2-cap | LEVEL | B2 | B2, B2, B2 | - |  |
| s-b1-abschied/off-topic-fluent | TRAP/OFF_TOPIC_FLUENT | B2 | B2, B2, B2 | OFF_TOPIC |  |
| s-b1-abschied/long-errors | TRAP/LONG_ERRORS | A2 | B1, B1, B1 | - | differs |
| s-b2-grossraum/b1 | LEVEL | B1 | B1, B1, B1 | - |  |
| s-b2-grossraum/b2 | LEVEL | B2 | C1, C1, C1 | - | differs |
| s-b2-grossraum/c1 | LEVEL | C1 | C1, C1, C1 | EVIDENCE_UNVERIFIED |  |
| s-b2-grossraum/memorised-template | TRAP/MEMORISED_TEMPLATE | B1 | B1, B1, B1 | - |  |
| s-c1-erreichbar/b2 | LEVEL | B2 | B2, C1, B2 | - | differs |
| s-c1-erreichbar/c1 | LEVEL | C1 | C1, C2, C2 | EVIDENCE_UNVERIFIED | differs |

## Misses in detail (a final level two or more away from the target, no level, or an A0 fixture above A0)

### w-c2-sievers/b2 (target B2)

- level C2, raw C2, flags -
- summary: The candidate demonstrates an outstanding command of German, answering every point of the C2 prompt in a clear, well-structured, and highly accurate formal email. The text flows seamlessly with near-perfect grammatical control. To achieve a C2 overall, the candidate could expand their lexical range with more idiomatic expressions and subtle stylistic nuances beyond clear standard formal language.
  - TASK_ACHIEVEMENT C2: The text addresses all four points raised in the journalist's inquiry completely and in a logical sequence. The notes are smoothly integrated into natural formal prose without adopting verbatim phrasing.
  - COHERENCE C2: The text flows seamlessly with effortless transitions and precise reference structures that guide the reader smoothly. Linking devices and sentence connectors are used naturally throughout the email.
  - RANGE C1: The response exhibits a broad lexical repertoire and complex grammatical structures, including passive forms, relative clauses, and Konjunktiv II. To reach C2 range, the candidate would need to demonstrate even greater stylistic variety, idiomatic nuance, and fine shades of meaning.
  - ACCURACY C2: The text shows near-complete grammatical control across various complex structures with no pattern of errors. Case endings, word order, verbal agreement, and spelling are consistently correct.
