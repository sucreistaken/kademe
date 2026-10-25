# Grading calibration: round-0-baseline

Date 2026-10-25, provider gemini, model gemini-3.6-flash, 3 runs per fixture, 85 fixtures, temperature default, seed none, 1 model answer per run (median).

Goals (exact >= 70%, within one >= 95%, every A0 fixture A0 in every run, nothing above the task cap, repeated runs agree >= 90%): **not met (exact agreement below 70%; 10 A0 fixture(s) not A0 in every run)**.

## Summary

- fixtures 85, runs 255, graded 249, unparseable 0, errors 0
- exact 49.4%, within one 96.5%; on the 71 fixtures a blind rater also holds: exact 52.6%, within one 95.8%
- repeated runs agree: pairwise 96.0%, fixtures with all runs equal 94.0%
- A0 fixtures 17, not A0 in every run: 10 (w-a1-tim/blank, w-a1-tim/words-only, w-a1-tim/task-copied, w-a2-umzug/dots-only, w-b1-hanna/task-copied, w-b1-forum/task-copied, w-b2-kurs/task-copied, w-c1-online/task-copied, w-c2-sievers/notes-pasted, s-a1-intro/task-read-aloud)
- above the task cap: final 0, raw model 0
- mean signed bias by target level: A0 +0.53 (45 runs), A1 +0.51 (39 runs), A2 +0.42 (57 runs), B1 +0.54 (39 runs), B2 +0.56 (45 runs), C1 +0.57 (21 runs), C2 +0 (3 runs)
- flag OFF_TOPIC: precision 100.0%, recall 100.0% (tp 12, fp 0, fn 0)
- flag TOO_SHORT: precision 17.0%, recall 100.0% (tp 9, fp 44, fn 0)
- flag NOT_GERMAN: precision 100.0%, recall 100.0% (tp 18, fp 0, fn 0)
- flag EMPTY: precision 25.0%, recall 100.0% (tp 6, fp 18, fn 0)
- flag COPIED_TASK: precision -, recall 0.0% (tp 0, fp 0, fn 21)
- diagnostics: {"LEVEL_CAPPED":0,"A0_RAISED":69,"EVIDENCE_UNVERIFIED":9}

## Confusion matrix (rows: target level, columns: proposed level, all runs)

| target \ proposed | A0 | A1 | A2 | B1 | B2 | C1 | C2 | none |
|---|---|---|---|---|---|---|---|---|
| A0 | 21 | 24 | . | . | . | . | . | 6 |
| A1 | . | 19 | 20 | . | . | . | . | . |
| A2 | . | . | 33 | 24 | . | . | . | . |
| B1 | . | . | . | 18 | 21 | . | . | . |
| B2 | . | . | . | . | 23 | 19 | 3 | . |
| C1 | . | . | . | . | . | 9 | 12 | . |
| C2 | . | . | . | . | . | . | 3 | . |

## Per fixture

| fixture | kind | target | runs: final level, [raw model level] | flags seen | |
|---|---|---|---|---|---|
| w-a1-tim/blank | A0 | A0 | EMPTY, EMPTY, EMPTY | EMPTY | differs |
| w-a1-tim/turkish | A0 | A0 | A0, A0, A0 | NOT_GERMAN |  |
| w-a1-tim/words-only | A0 | A0 | A1 [A0], A1, A1 | TOO_SHORT A0_RAISED | differs |
| w-a1-tim/task-copied | TRAP/TASK_COPIED | A0 | A1 [A0], A1 [A0], A1 [A0] | EMPTY A0_RAISED OFF_TOPIC | differs |
| w-a1-tim/a1-clean | LEVEL | A1 | A2, A2, A2 | - | differs |
| w-a1-tim/a1-errors | LEVEL | A1 | A1, A1, A1 | TOO_SHORT |  |
| w-a1-tim/a2 | LEVEL | A2 | A2, A2, A2 | - |  |
| w-a1-tim/over-cap | TRAP/OVER_CAP | A2 | A2, A2, A2 | - |  |
| w-a1-krank/english | A0 | A0 | A0, A0, A0 | NOT_GERMAN |  |
| w-a1-krank/memorised-intro | TRAP/MEMORISED_TEMPLATE | A1 | A2, A2, A2 | OFF_TOPIC | differs |
| w-a1-krank/a1-clean | LEVEL | A1 | A2, A2, A2 | - | differs |
| w-a1-krank/a1-errors | LEVEL | A1 | A1, A1, A1 | TOO_SHORT |  |
| w-a1-krank/a2-cap | LEVEL | A2 | A2, A2, A2 | - |  |
| w-a2-umzug/dots-only | A0 | A0 | EMPTY, EMPTY, EMPTY | EMPTY | differs |
| w-a2-umzug/a1 | LEVEL | A1 | A1, A1, A1 | TOO_SHORT |  |
| w-a2-umzug/a2 | LEVEL | A2 | B1, B1, B1 | - | differs |
| w-a2-umzug/b1-cap | TRAP/OVER_CAP | B1 | B1, B1, B1 | - |  |
| w-a2-heizung/turkish-mixed | A0 | A0 | A0, A0, A0 | NOT_GERMAN TOO_SHORT |  |
| w-a2-heizung/a1 | LEVEL | A1 | A1, A2, A1 | TOO_SHORT | differs |
| w-a2-heizung/a2 | LEVEL | A2 | A2, A2, A2 | - |  |
| w-a2-heizung/b2-over-cap | TRAP/OVER_CAP | B1 | B1, B1, B1 | - |  |
| w-b1-hanna/task-copied | TRAP/TASK_COPIED | A0 | A1 [A0], A1 [A0], A1 [A0] | EMPTY TOO_SHORT A0_RAISED | differs |
| w-b1-hanna/a1-short | LEVEL | A1 | A2, A2, A2 | TOO_SHORT | differs |
| w-b1-hanna/a2 | LEVEL | A2 | B1, B1, B1 | - | differs |
| w-b1-hanna/b1 | LEVEL | B1 | B2, B2, B1 | - | differs |
| w-b1-hanna/b2 | LEVEL | B2 | B2, B2, B2 | - |  |
| w-b1-hanna/c1-over-cap | TRAP/OVER_CAP | B2 | B2, B2, B2 | - |  |
| w-b1-hanna/long-errors | TRAP/LONG_ERRORS | A2 | B1, B1, B1 | - | differs |
| w-b1-markt/b1 | LEVEL | B1 | B1, B2, B1 | - | differs |
| w-b1-markt/memorised-template | TRAP/MEMORISED_TEMPLATE | A2 | B1, B1, B1 | - | differs |
| w-b1-markt/off-topic-fluent | TRAP/OFF_TOPIC_FLUENT | B2 | B2, B2, B2 | OFF_TOPIC |  |
| w-b1-markt/short-excellent | TRAP/SHORT_EXCELLENT | B2 | B2, B2, B2 | - |  |
| w-b1-forum/a2 | LEVEL | A2 | A2, A2, A2 | TOO_SHORT |  |
| w-b1-forum/b1 | LEVEL | B1 | B2, B2, B2 | - | differs |
| w-b1-forum/b2 | LEVEL | B2 | B2, B2, B2 | - |  |
| w-b1-forum/task-copied | TRAP/TASK_COPIED | A0 | A1 [A0], A1 [A0], A1 [A0] | EMPTY TOO_SHORT A0_RAISED | differs |
| w-b1-forum/memorised-template | TRAP/MEMORISED_TEMPLATE | A2 | A2, A2, A2 | - |  |
| w-b2-homeoffice/english | A0 | A0 | A0, A0, A0 | NOT_GERMAN TOO_SHORT |  |
| w-b2-homeoffice/a2 | LEVEL | A2 | A2, A2, A2 | TOO_SHORT |  |
| w-b2-homeoffice/b1 | LEVEL | B1 | B2, B2, B2 | - | differs |
| w-b2-homeoffice/b2 | LEVEL | B2 | C1, C1, C1 | - | differs |
| w-b2-homeoffice/c1 | LEVEL | C1 | C1, C1, C1 | - |  |
| w-b2-homeoffice/memorised-template | TRAP/MEMORISED_TEMPLATE | A2 | A2, A2, A2 | TOO_SHORT |  |
| w-b2-homeoffice/long-errors | TRAP/LONG_ERRORS | A2 | B1, B1, B1 | - | differs |
| w-b2-kurs/task-copied | TRAP/TASK_COPIED | A0 | A1 [A0], A1 [A0], A1 [A0] | EMPTY TOO_SHORT A0_RAISED | differs |
| w-b2-kurs/b1 | LEVEL | B1 | B2, B2, B2 | - | differs |
| w-b2-kurs/b2 | LEVEL | B2 | C1, C1, C1 | - | differs |
| w-b2-kurs/off-topic-fluent | TRAP/OFF_TOPIC_FLUENT | B2 | B2, B2, C1 | OFF_TOPIC | differs |
| w-b2-kurs/c1 | LEVEL | C1 | C1, C1, C1 | EVIDENCE_UNVERIFIED |  |
| w-c1-noten/a1-short | LEVEL | A1 | A1, A1, A2 | TOO_SHORT | differs |
| w-c1-noten/b1 | LEVEL | B1 | B1, B1, B1 | TOO_SHORT |  |
| w-c1-noten/b2 | LEVEL | B2 | C1, C1, C1 | EVIDENCE_UNVERIFIED | differs |
| w-c1-noten/c1 | LEVEL | C1 | C2, C2, C2 | - | differs |
| w-c1-online/task-copied | TRAP/TASK_COPIED | A0 | A1 [A0], A1 [A0], A1 [A0] | EMPTY TOO_SHORT OFF_TOPIC A0_RAISED | differs |
| w-c1-online/b2 | LEVEL | B2 | C1, C1, C1 | - | differs |
| w-c1-online/c1 | LEVEL | C1 | C2, C2, C2 | - | differs |
| w-c2-sievers/notes-pasted | TRAP/TASK_COPIED | A0 | A1 [A0], A1 [A0], A1 [A0] | TOO_SHORT A0_RAISED | differs |
| w-c2-sievers/a2 | LEVEL | A2 | A2, A2, A2 | TOO_SHORT |  |
| w-c2-sievers/b2 | LEVEL | B2 | C2, C2, C2 | - | differs |
| w-c2-sievers/c1 | LEVEL | C1 | C2, C2, C2 | - | differs |
| w-c2-sievers/c2 | LEVEL | C2 | C2, C2, C2 | - |  |
| s-a1-intro/almost-silent | A0 | A0 | A0, A0, A0 | EMPTY TOO_SHORT |  |
| s-a1-intro/turkish | A0 | A0 | A0, A0, A0 | NOT_GERMAN |  |
| s-a1-intro/task-read-aloud | TRAP/TASK_COPIED | A0 | A1 [A0], A1 [A0], A1 [A0] | EMPTY A0_RAISED | differs |
| s-a1-intro/a1-clean | LEVEL | A1 | A2, A2, A2 | A0_RAISED | differs |
| s-a1-intro/a1-errors | LEVEL | A1 | A1, A1, A1 | A0_RAISED |  |
| s-a1-intro/a2-cap | LEVEL | A2 | A2, A2, A2 | A0_RAISED |  |
| s-a2-alltag/english | A0 | A0 | A0, A0, A0 | NOT_GERMAN |  |
| s-a2-alltag/a1 | LEVEL | A1 | A2, A2, A2 | TOO_SHORT A0_RAISED | differs |
| s-a2-alltag/a2 | LEVEL | A2 | B1, B1, B1 | A0_RAISED | differs |
| s-a2-alltag/b1-cap | TRAP/OVER_CAP | B1 | B1, B1, B1 | A0_RAISED |  |
| s-a2-chefin/a1 | LEVEL | A1 | A1, A1, A1 | TOO_SHORT A0_RAISED |  |
| s-a2-chefin/a2 | LEVEL | A2 | B1, B1, B1 | A0_RAISED | differs |
| s-a2-chefin/b1-cap | TRAP/OVER_CAP | B1 | B1, B1, B1 | EVIDENCE_UNVERIFIED A0_RAISED |  |
| s-b1-abschied/a2 | LEVEL | A2 | A2, A2, A2 | TOO_SHORT A0_RAISED |  |
| s-b1-abschied/b1 | LEVEL | B1 | B2, B2, B2 | A0_RAISED | differs |
| s-b1-abschied/b2-cap | LEVEL | B2 | B2, B2, B2 | A0_RAISED |  |
| s-b1-abschied/off-topic-fluent | TRAP/OFF_TOPIC_FLUENT | B2 | B2, B2, B2 | OFF_TOPIC EVIDENCE_UNVERIFIED A0_RAISED |  |
| s-b1-abschied/long-errors | TRAP/LONG_ERRORS | A2 | B1, B1, B1 | A0_RAISED | differs |
| s-b2-grossraum/b1 | LEVEL | B1 | B2, B2, B2 | A0_RAISED EVIDENCE_UNVERIFIED | differs |
| s-b2-grossraum/b2 | LEVEL | B2 | C1, C1, C1 | A0_RAISED | differs |
| s-b2-grossraum/c1 | LEVEL | C1 | C1, C1, C1 | A0_RAISED EVIDENCE_UNVERIFIED |  |
| s-b2-grossraum/memorised-template | TRAP/MEMORISED_TEMPLATE | B1 | B2, B2, B2 | EVIDENCE_UNVERIFIED A0_RAISED | differs |
| s-c1-erreichbar/b2 | LEVEL | B2 | C1, C1, C1 | A0_RAISED | differs |
| s-c1-erreichbar/c1 | LEVEL | C1 | C2, C2, C2 | A0_RAISED | differs |

## Misses in detail (a final level two or more away from the target, no level, or an A0 fixture above A0)

### w-a1-tim/blank (target A0)

- level EMPTY, raw -, flags EMPTY

### w-a1-tim/words-only (target A0)

- level A1, raw A0, flags TOO_SHORT A0_RAISED
- summary: The response contains only eight words consisting of formulaic greetings and nouns copied from the prompt, with no complete sentences attempted. As a result, the performance does not show assessable German sentence structure and is rated at A0.
  - TASK_ACHIEVEMENT A1: The text consists only of isolated words mostly copied from the prompt, without answering any of the questions in complete sentences.
  - COHERENCE A1: There is no text structure or sentence connection present, as the submission only lists standalone words.
  - RANGE A1: The response relies entirely on formulaic greetings and key nouns copied directly from the task prompt.
  - ACCURACY A1: No grammatical structures or complete sentences are attempted, so grammatical accuracy cannot be demonstrated.

### w-a1-tim/task-copied (target A0)

- level A1, raw A0, flags EMPTY A0_RAISED
- summary: The candidate submitted the prompt text verbatim without writing an actual response. Because no original German text was produced, the answer cannot be scored and receives an overall level of A0.
  - TASK_ACHIEVEMENT A1: (not assessable) The candidate merely copied the task prompt verbatim and did not produce an answer.
  - COHERENCE A1: (not assessable) Coherence cannot be assessed because no original text was produced by the candidate.
  - RANGE A1: (not assessable) Range cannot be evaluated because the candidate only submitted text copied directly from the task prompt.
  - ACCURACY A1: (not assessable) Accuracy cannot be evaluated as there is no candidate-generated language to judge.

### w-a2-umzug/dots-only (target A0)

- level EMPTY, raw -, flags EMPTY

### w-b1-hanna/task-copied (target A0)

- level A1, raw A0, flags EMPTY TOO_SHORT A0_RAISED
- summary: The candidate submitted a verbatim copy of the prompt rather than writing an answer. Because no original German text was produced, the submission receives an overall assessment of A0.
  - TASK_ACHIEVEMENT A1: The submitted text is a verbatim copy of the task prompt, so no original content or task requirements are fulfilled by the candidate.
  - COHERENCE A1: Because the text is entirely copied from the task prompt, there is no candidate-produced text to evaluate for structural flow or linking.
  - RANGE A1: No candidate-produced language is present to evaluate range of vocabulary or structures.
  - ACCURACY A1: There is no candidate text available to judge grammatical or spelling accuracy.

### w-b1-forum/task-copied (target A0)

- level A1, raw A0, flags EMPTY TOO_SHORT A0_RAISED
- summary: The submission consists entirely of copied text from the task prompt. Because the candidate did not write any original text, no linguistic performance can be evaluated, resulting in an overall level of A0.
  - TASK_ACHIEVEMENT A1: (not assessable) The candidate merely copied the task prompt without providing any original contribution or addressing the prompt points.
  - COHERENCE A1: (not assessable) Coherence cannot be assessed because the candidate produced no original text.
  - RANGE A1: (not assessable) Language range cannot be evaluated as no text was written by the candidate.
  - ACCURACY A1: (not assessable) Grammatical control cannot be assessed as there is no candidate-produced language.

### w-b2-kurs/task-copied (target A0)

- level A1, raw A0, flags EMPTY TOO_SHORT A0_RAISED
- summary: The candidate submitted a response consisting solely of the copied task prompt with no original writing. As a result, there is no assessable language performance, leading to an overall level of A0.
  - TASK_ACHIEVEMENT A1: (not assessable) The text consists entirely of the copied task prompt without any original content from the candidate. Therefore, task achievement cannot be assessed.
  - COHERENCE A1: (not assessable) Because the submission is merely a repetition of the prompt text, coherence cannot be evaluated.
  - RANGE A1: (not assessable) No original text was written by the candidate, so lexical and grammatical range cannot be scored.
  - ACCURACY A1: (not assessable) Grammatical accuracy cannot be judged as there is no candidate-produced German language.

### w-c1-online/task-copied (target A0)

- level A1, raw A0, flags EMPTY TOO_SHORT OFF_TOPIC A0_RAISED
- summary: The candidate submitted only a copy of the task prompt rather than writing their own email. Because there is no candidate-generated German to evaluate, the performance receives an overall rating of A0.
  - TASK_ACHIEVEMENT A1: (not assessable) The text is entirely copied from the prompt instructions and contains no original response.
  - COHERENCE A1: (not assessable) Coherence cannot be assessed because the candidate produced no original sentences.
  - RANGE A1: (not assessable) Vocabulary and grammatical range cannot be evaluated as the submission merely repeats the task prompt.
  - ACCURACY A1: (not assessable) Grammatical accuracy cannot be judged due to the lack of any original candidate text.

### w-c2-sievers/notes-pasted (target A0)

- level A1, raw A0, flags TOO_SHORT A0_RAISED
- summary: The candidate copied the prompt notes verbatim without writing an actual email or producing any original German sentences. At 78 words, the response is also far below the required word count. Consequently, the performance cannot be scored above A0.
  - TASK_ACHIEVEMENT A1: The text consists entirely of bullet points copied verbatim from the task prompt notes. It does not attempt to write a formal email or use original sentences, completely failing to perform the writing task.
  - COHERENCE A1: There is no candidate-produced text structure, paragraphing, or cohesive devices. The response only pastes the notes from the task description.
  - RANGE A1: (not assessable) Vocabulary and grammatical structures cannot be assessed because the text contains no original language production by the candidate.
  - ACCURACY A1: (not assessable) Grammatical and orthographic accuracy cannot be evaluated as no original German sentences were produced.

### w-c2-sievers/b2 (target B2)

- level C2, raw C2, flags -
- summary: The candidate has produced an exemplary formal reply that fulfills all task requirements with precision and stylistic appropriateness. Sentence structure, vocabulary, and cohesive devices reflect a high level of language proficiency corresponding to C2. Grammatical accuracy is excellent throughout.
  - TASK_ACHIEVEMENT C2: The candidate addresses all points from the prompt thoroughly and in appropriate detail. The formal register and tone are maintained consistently throughout.
  - COHERENCE C2: The email flows logically from point to point with seamless transitions. Ideas are clearly structured and cohesive throughout.
  - RANGE C2: The text displays a broad and precise lexical repertoire along with sophisticated syntactic structures suitable for a formal business response.
  - ACCURACY C2: Grammatical control is near complete with no significant errors in word order, case agreement, or orthography.

### s-a1-intro/task-read-aloud (target A0)

- level A1, raw A0, flags EMPTY A0_RAISED
- summary: The candidate merely repeated the task prompt without producing any of their own German text. Consequently, none of the task points were addressed and no independent language performance was shown. The submission is evaluated at level A0.
  - TASK_ACHIEVEMENT A1: The candidate only read or repeated the prompt text and did not provide any information about themselves.
  - COHERENCE A1: There are no original utterances to assess text organization or sentence connection.
  - RANGE A1: The response consists entirely of words copied from the task prompt, showing no independent vocabulary or structures.
  - ACCURACY A1: No candidate produced language is available to evaluate grammatical accuracy.
  - FLUENCY A1: Fluency cannot be evaluated meaningfully because the speaker only read back the prompt text.
  - PRONUNCIATION A1: (not assessable) cannot be judged from a transcript
