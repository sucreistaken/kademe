#!/usr/bin/env bash
# End to end check of the candidate surface against a running dev server.
#
# Covers the three things that are easy to break and expensive to get wrong:
# server-authoritative timing, the chunked upload pipeline, and the guarantee
# that no manager-only field ever reaches a candidate response.
#
# Usage: bash scripts/verify-candidate-flow.sh <raw token> [base url]
set -uo pipefail

TOKEN="${1:?usage: verify-candidate-flow.sh <raw token> [base url]}"
HOST="${2:-http://localhost:3100}"
B="$HOST/api/c/$TOKEN"
TMP="$(mktemp -d)"
FAILED=0

say() { printf '\n== %s\n' "$1"; }
ok()  { printf '   ok   %s\n' "$1"; }
bad() { printf '   FAIL %s\n' "$1"; FAILED=1; }

# Every response body is appended here and scanned for leaks at the end.
ALL="$TMP/all.json"
: > "$ALL"

call() { # method path [json body]
  local method="$1" path="$2" body="${3:-}"
  local out
  if [ -n "$body" ]; then
    out=$(curl -s -X "$method" -H 'content-type: application/json' -d "$body" "$B$path")
  else
    out=$(curl -s -X "$method" "$B$path")
  fi
  printf '%s\n' "$out" >> "$ALL"
  printf '%s' "$out"
}

jq_py() { python3 -c "import json,sys;d=json.load(sys.stdin);$1"; }

say "state"
STEP=$(call GET /state | jq_py "print(d['step'])")
ok "step=$STEP"

say "consent"
STEP=$(call POST /consent '{"accepted":true}' | jq_py "print(d['step'])")
ok "step=$STEP"

if [ "$STEP" = "INFO" ]; then
  STEP=$(call POST /info '{"fullName":"Ayse Demir","email":"ayse@ornek.com"}' | jq_py "print(d['step'])")
  ok "info -> $STEP"
fi
if [ "$STEP" = "DONE" ]; then
  printf '\n   This candidate has already finished the assessment, so there is no\n'
  printf '   stage left to drive. Point the script at one that has not finished.\n\n'
  exit 2
fi
if [ "$STEP" = "CHECK" ]; then
  STEP=$(call POST /device-check '{"camera":"FaceTime HD","microphone":"MacBook Mic"}' | jq_py "print(d['step'])")
  ok "device check -> $STEP"
fi

say "timer authority: start twice, refresh once, deadline must not move"
D1=$(call POST /stage/start '{}' | jq_py "print(d['stage']['deadlineAt'])")
sleep 1
D2=$(call POST /stage/start '{}' | jq_py "print(d['stage']['deadlineAt'])")
R1=$(call GET /state | jq_py "print(d['stage']['deadlineAt'])")
if [ "$D1" = "$D2" ] && [ "$D1" = "$R1" ]; then
  ok "deadline stable across restart and refresh ($D1)"
else
  bad "deadline moved: $D1 / $D2 / $R1"
fi

say "heartbeat"
call POST /stage/heartbeat '{}' | jq_py "print('remainingMs', d['remainingMs'], 'active', d['active'])"

REMAINING=$(call GET /state | jq_py "print(d['stage']['remainingMs'] if d.get('stage') else 0)")
# Writes carry the stage position since 2026-09-11, so a stale tab cannot
# write into the next stage; a missing or wrong position is a 409 STAGE_MISMATCH.
POS=$(call GET /state | jq_py "print(d['stage']['position'] if d.get('stage') else 0)")

if [ "$REMAINING" = "0" ]; then
  # This candidate arrived with a stage whose deadline had already passed, so
  # the expired path is what there is to check: writes refused, close allowed.
  say "stage is already past its deadline: checking the expiry path instead"
  WRITE=$(call POST /media/init "{\"activityIndex\":0,\"stagePosition\":$POS,\"mime\":\"video/webm\"}")
  printf '%s' "$WRITE" | grep -q STAGE_EXPIRED \
    && ok "writes refused after the deadline" || bad "a write was accepted after the deadline"
  CODE=$(curl -s -o "$TMP/submit.json" -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' "$B/stage/submit")
  cat "$TMP/submit.json" >> "$ALL"
  [ "$CODE" = "200" ] && ok "an expired stage can still be closed" || bad "expected 200, got $CODE"
else
  say "required activities block the submit"
  CODE=$(curl -s -o "$TMP/submit.json" -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' "$B/stage/submit")
  cat "$TMP/submit.json" >> "$ALL"
  [ "$CODE" = "422" ] && ok "submit refused with 422 while required answers are missing" \
                      || bad "expected 422, got $CODE"

  say "chunked upload: init, three parts, complete"
  say "stale tab guard: a write without the stage position is refused"
  STALE=$(call POST /media/init '{"activityIndex":0,"mime":"video/webm"}')
  printf '%s' "$STALE" | grep -q STAGE_MISMATCH && ok "write without stage position refused" || bad "write without stage position accepted"

  INIT=$(call POST /media/init "{\"activityIndex\":0,\"stagePosition\":$POS,\"mime\":\"video/webm;codecs=vp9\"}")
  REF=$(printf '%s' "$INIT" | jq_py "print(d['uploadRef'])")
  printf '%s' "$INIT" | jq_py "print('minPartBytes', d['minPartBytes'], 'proxy', d['proxy'], 'targets', len(d['partTargets']))"
  head -c 120000 /dev/urandom > "$TMP/chunk.bin"
  for n in 1 2 3; do
    curl -s -X PUT --data-binary "@$TMP/chunk.bin" "$B/media/part?ref=$REF&part=$n" >> "$ALL"
  done
  DONE=$(call POST /media/complete "{\"uploadRef\":\"$REF\",\"durationMs\":15000}")
  printf '%s' "$DONE" | jq_py "print('status', d['status'], 'bytes', d['bytes'])"
  [ "$(printf '%s' "$DONE" | jq_py "print(d['bytes'])")" = "360000" ] \
    && ok "three parts assembled into one object" || bad "assembled size wrong"
fi

say "another candidate's upload reference is refused"
STOLEN=$(call POST /media/complete '{"uploadRef":"00000000-0000-0000-0000-000000000000"}')
printf '%s' "$STOLEN" | grep -q UPLOAD_NOT_FOUND && ok "foreign upload ref rejected" || bad "foreign upload ref accepted"

say "technical events: only real ones are stored"
call POST /event '{"events":[{"type":"VISIBILITY_HIDDEN"},{"type":"WINDOW_BLUR"},{"type":"MADE_UP_EVENT"}]}' \
  | jq_py "print('logged', d['logged'])" 

say "leak scan over every response body"
LEAKS=$(grep -o -E '"(internalQuestion|internalObjective|internalPurpose|expectedBehaviours|redFlags|managerNotes|correct)"' "$ALL" | sort -u || true)
if [ -z "$LEAKS" ]; then
  ok "no manager-only field appeared in any candidate response"
else
  bad "leaked keys: $LEAKS"
fi

printf '\n'
if [ "$FAILED" = "0" ]; then printf 'ALL CHECKS PASSED\n'; else printf 'SOME CHECKS FAILED\n'; fi
rm -rf "$TMP"
exit "$FAILED"
