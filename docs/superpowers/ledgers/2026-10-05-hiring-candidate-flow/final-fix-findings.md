# Plan 2 final fix wave (whole-branch review of 39c1b50..955d6c0, verdict: Ready with fixes)

Controller rulings are binding. Code English, product copy TR/EN ("sen" on the hiring side), never the em-dash. Each item: file:line from the reviewer, then the ruling.

## DO NOW
1. (Critical) Merge origin/main (739f218) into platform/solutions with a normal merge commit (never rebase, never touch main). Conflicts: exam-flow.ts keep the branch version (b49f643 covers 0e12393); recorder.ts keep the branch RetryPolicy and set EXAM_RETRY.retryTargets: true (recorder.ts:105); keep main's recorder.test.ts cases (a failed exam lookup retried within the part's 3 tries; targetFor caches) next to the branch's tests. Gate: exam tests + verify:exam.
2. (I5) closeRun (candidate.ts:217-258): for recording rows with media_asset_id IS NULL, set it to the newest READY/INCOMPLETE take with no newer UPLOADING take (rows already locked); test. Soften the doc comment at candidate.ts:739-743; retitle the exam media/complete route test that says 500 but pins propagation (C11).
3. (I1) Hiring report copy (hiringFrame.reportSent, hiringDevice.reportSent, TR/EN): no promise of a reply; e.g. TR "Bildirimin kaydedildi. Acil bir durumda <mail>{email}</mail> adresine yaz." with state.contactEmail (opening contact, else org). Drop "Genelde aynı gün dönülür". Copy test.
4. (I2 + I4a; C24 RULING: stage start/submit times, was_late, closed_by, first-open and consent IP + browser info count as technical records) Extend HIRING_CONSENT_TR/EN (consent-default.ts) and signalTECHNICAL (TR/EN): IP address and browser info at first open and at consent; stage start and finish times; whether time ran out. Drop "ekip sana yeniden hak verebilir" (no retake exists). Pin the texts in tests. ensureHiringConsentText inserts a new version when the built-in text differs from the org's latest auto-created version (test); invitations already sent keep their frozen text.
5. (I3) listOpeningCandidates (invitations.ts:631): `adapted` only when viewer.runs AND the viewer is not in hiring_assignments for that assessment; pass viewer.id; tests both ways.
6. (I6) RightsForm (RightsForm.tsx:50): real failure state with retry, no false "Talebin iletildi"; the rights route splits KIND_REQUIRED from a malformed body; tests.
7. resolveOwnedMedia: require a UUID (regex), not just 36 chars, in core and hiring media routes; test (malformed id -> the documented 404/400, never 500).
8. hiring/media/play: Cache-Control: no-store; test.
9. problem route: outbox row and NEW_LINK insert in one transaction; skip the team mail when the request was deduplicated; tests.
10. SurveyBody: a non-string comment is refused with REQUEST_INVALID (test).
11. Tests: malformed-body mapping on the other 6 hiring routes; requireHiring throw paths; heartbeat wiring.
12. GET /consent `accepted` is stripped by candidateSafe: check the exam client's use first; rename to `consented` (both sides) or drop it if unused; test.
13. nextPath: a non-exam state without `path` goes to the landing, not the exam mapping; test.
14. verify:guard deletes its own audit_logs and message_outbox rows; prove counts unchanged after a run.
15. aria-describedby on Today's disabled invite button (id + -why).
16. Comments/copy: FLUSH_MS comment (stage-runner) says the time-up submit carries no answer; invite preview heading no longer says "as they will be saved" for marked rows.
17. Add autoScore / auto_score to candidateSafe INTERNAL_FIELDS; test.
18. Invite message minutes include ALLOW_GRACE grace like the landing (invitations.ts:113-116, C25); test.
19. STATUS edits: add the Task 1 retention carry (purge clears candidate-written text and dangling asset ids) and I7 (hiring decisions feed the media retention anchor) as plan 3 binding items; item 24 lists IP/UA and stage metadata as stored and now disclosed; row 80 "sahte medya yok" -> "PROCTOR_DEV_FAKE kapalı; gerçek cihaz değil, sentetik akış"; correct the A6 line (fixture's only evaluator was the owner); item 7 points to item 19; record the C24 ruling and the merge of main 739f218.

## DEFER (recorded, not in this wave)
20. Plan 2b: faqPhoneA/needDevice phone copy (desktop-only screen), InfoForm raw errors and <16px inputs, Task 12 polish list, Task 14 stopWatching on NO_PARTS and "Bu cevabı kullan" after TAKES_EXHAUSTED, Task 15 N1, Task 18 expired card "open" on a closed opening and visual-only notices, pale primary for 1-2 s without a reason, Task 13 residuals.
21. Plan 3 binding: I7 retention anchor; purge of candidate text and dangling ids; M6 family (stored vs declared size, running byte cap, nosniff + attachment serving, recordPart RMW without lock incl. exam, part-done status check, failMedia aborting R2 multipart); transcribe only the chosen take, skip file answers; problem reports + NEW_LINK in Today "Talepler" with the opening contact everywhere; /info overwrite rule for hiring; retake only if "yeniden hak" returns; client revision for PUT vs beacon; serves refusing non-PUBLISHED versions; raw tokens in message_outbox policy; existing carries (data rights place with KVKK window, survey differencing, names in comments, WebM remux + Safari playback, visibility, feedback date + overdue, contact email at publish, in-stage time, extra time in estimate, Candidates-tab redesign V8); per-opening upload cap.
22. Separate user decision (pre-existing on main): panel <html lang> stays "tr" in EN; no sign-out control; exam pages resolve the token twice.
23. Benchmark: STATUS item 20 list + a real-camera exam take on the merged path after item 1.
