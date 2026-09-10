# Transcription pipeline

Turns a finished recording into a transcript with word level timestamps, so the
manager can read instead of watch and click a word to seek the video.

```
media/complete  ──enqueue──▶  pgboss.job (transcription)
                                    │
      Cloud Scheduler ──POST──▶ /api/cron/transcribe
                                    │  fetch batch
                                    ▼
                             runTranscription(mediaAssetId)
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
              transcripts row                 ai_runs row
         (text, words, language)     (purpose, model, cost, error)
```

## Why a cron drain and not a worker

pg-boss can run a resident subscriber with `boss.work()`. That is the wrong
shape here: the application is deployed to Cloud Run and scales to zero, so
nothing keeps a process alive between requests. A subscriber would only run
inside whichever request happened to wake an instance, and jobs would sit until
one did.

So the queue is used for what is genuinely hard, and nothing else:

- durable storage of the work,
- exactly-once fetching across concurrent instances,
- retries with exponential backoff (`retryLimit: 4`, `retryDelay: 60`),
- one job per media asset while it is queued or active (`stately` policy plus
  `singletonKey`), so a re-enqueue cannot duplicate work.

Draining is a scheduled `POST /api/cron/transcribe`, protected by `CRON_SECRET`
and compared in constant time. It sweeps, fetches a batch of three, and
completes or fails each job.

## The sweep

Enqueueing deliberately swallows its own errors: a candidate finishing an answer
must never see a failure because a background job could not be written. The cron
therefore starts by looking for recordings from the last day that are READY or
INCOMPLETE, are audio or video, and have no transcript, and enqueues them.

The one day bound is on purpose. A recording the provider genuinely cannot read
would otherwise be re-queued forever after its retries were exhausted.

INCOMPLETE assets are transcribed too. A recording that was cut short is exactly
the one a manager would rather read than watch.

## Two rules that are not negotiable

**A failed transcription writes nothing.** No row, no placeholder, no
approximation. The review screen already says "this answer has no transcript
yet", which is honest; invented text would be scored as if the candidate had
said it.

**Every call is recorded in `ai_runs`**, success or failure, with purpose
`TRANSCRIPTION`, the model id, the storage key as `input_ref`, and either the
transcript id or the error message. That is the AI Act traceability story for
this product: we can show every model call we made.

`cost_usd` is an estimate derived from media duration and the published rate in
`ELEVENLABS_STT_USD_PER_HOUR`, not an invoice. It lives in configuration because
a price that drifts silently would turn that column into a lie.

## Language

`assessments.locale` is passed as `language_code`, but only as a hint: a
candidate invited in Turkish may answer in English, so Scribe stays free to
disagree, and whatever it reports is what lands in `transcripts.language`.

## Provider

Behind the `Transcriber` interface in `src/lib/transcription.ts`.

- `ElevenLabsTranscriber` when `ELEVENLABS_API_KEY` is set. With R2 it hands
  Scribe a 15 minute signed URL so the bytes never pass through this process;
  with local development storage there is no publicly reachable URL, so the file
  is posted as multipart.
- `NoopTranscriber` otherwise. It refuses rather than pretending, and the cron
  endpoint answers `{ skipped: true }` and leaves the jobs queued instead of
  burning their retry budget against a provider that does not exist.

Only `word` entries from the response are kept. `spacing` and `audio_event`
entries carry no position worth clicking on.

## Verifying it

```bash
npx tsx scripts/verify-transcription.ts        # queue round trip, skip rules, refusal with no key
npx tsx scripts/verify-transcription-drain.ts  # the cron drain and the failure path, offline
pnpm test                                      # response mapping, timestamps, cost
```

`verify-transcription-drain.ts` points storage at an empty directory so every
asset fails before any network call: it proves that a failure writes no
transcript, records the reason in `ai_runs`, and returns the job to the queue,
without sending anything to a third party.

**What none of this proves is a successful Scribe call.** That needs a real
`ELEVENLABS_API_KEY`. Until then the pipeline is verified up to the provider
boundary and no further.
