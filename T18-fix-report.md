# T18 fix round 1 report

Branch: worktree-agent-a6cc8c65d2b71025d (base ab621e2). Commits: b40213f (manager, settings, library, advanced), e44d060 (glossary), 1c9220a (hiring), d32dc9a (screens).

All findings applied (1-13, decisions on open choices, 15-17, 18-41 style list, 42 glossary, overflow, delta pass).

- 1, 10, 13, 16 and the hiring items of 18-41: hiring.de.json (experienceTitle, boundary, Ausschreibung wording, quoted button names, funnel/publish/members texts).
- 2: screens exams.pSecondBLOCK.
- 3: "Bereich(e)" to "Abschnitt(e)" in all screens values; hiringBuilder.saveRefused now says "Wertebereich"; glossary row.
- 4, 5, 6, 8, 9, 11: screens, as specified.
- 7: bulkInvalid, generateRejected, createQuestions.dropped, aiPending, reportNote (plural branches added).
- 12: all 28 "Ihre Rolle darf" strings replaced; grep shows zero left.
- Proctoring flag: "Auffälligkeit(en)" everywhere specified (integrityFlags, proctoringLead, terminationNote, recording legends, audit integrity_flag_*). Remaining "Hinweis" are only hiring question-check hints and hiringBuilder notes.
- Last entry ("Spätester Beginn"), Tick n, Stichpunkt, reviewer "Bewerter": applied.
- 15: all straight quotes converted to „…“ (0 straight quotes left in the six files).
- 17: ICU plural added (placeholder names unchanged) for bulk*, import, ownValues, generateDone, groupSub, advanced counts, aiPending, aiNote, words, checkLead, kindTexts, inviteExpires, hiring day/answer/phase/question counts.
- Delta pass: translated result.showLevel/levelShownNow/levelHiddenNow/levelSave/levelHint and resultReport.copyStudent/copyTeacher/studentCopyHint. Remaining identical-to-EN values are deliberate tokens (Status, Pause, Standard, CSV column names c_*, etc.).
- Glossary: section, reviewer, flag, release, opening rows updated; "hiring" row added; masculine "Bewerber" noted.

Not applied: nothing. Judgement calls: hiringOverview.funnelMedian became "Median {minutes} Min. (...)" (finding gave only "Median"); wording of the delta-pass strings is mine.

Tests: `pnpm vitest run src/i18n` 5 files, 96 tests passed.

## Round 2 (A-I)
All applied: A feedbackHint reverted (no plural, avoids NaN), B aiPending plural, C technicalHint, D aiForbidden period, E onceNoteMany quotes, F headTechnical/reportTechnical plurals, G faultSTART_*, H plurals (examMeta sections, createExam.gap, levelCount, checkLeadAllOk; call sites pass numbers: o.sections is number, ok/valid and dist[l] counts, g.missing, m.technicalEvents), I copyStudent/copyTeacher/studentCopyHint/levelHint. Tests: 96 passed.
