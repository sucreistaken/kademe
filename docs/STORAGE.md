# Storage

Every recording, uploaded file and generated object goes through one interface,
`StorageProvider` in `src/lib/storage.ts`. There are two implementations. Which
one runs is decided by the environment, never by code.

`docs/STATUS.md` still lists R2 as "not started". That is out of date: the R2
implementation exists. What does not exist is any evidence that it works, and
this document is careful about the difference.

## Environment variables

| Variable | Used by | Meaning |
|---|---|---|
| `R2_ACCESS_KEY_ID` | R2 | S3 API access key id for the bucket. |
| `R2_SECRET_ACCESS_KEY` | R2 | Its secret. |
| `R2_ENDPOINT` | R2 | `https://<account id>.r2.cloudflarestorage.com`. Bucket name is not part of it. |
| `R2_BUCKET` | R2 | Bucket name, for example `kademe-media`. |
| `LOCAL_STORAGE_DIR` | local | Where objects are written. Defaults to `.storage/` under the working directory. |
| `AUTH_SECRET` | local | Signs the local playback URLs. Falls back to a fixed development string outside production; in production a missing value throws. |
| `STORAGE_ALLOW_LOCAL` | local | `true` lets a production process use local disk storage. An explicit operator opt in; nothing else is accepted. Requires `AUTH_SECRET`. |
| `STORAGE_REQUIRE_R2` | both | When set, a missing or partial R2 configuration throws instead of falling back to disk, in any environment. Production behaves this way without it. |

`R2_ACCOUNT_ID` appears in `.env.example` but the code never reads it; the
account id is already inside `R2_ENDPOINT`.

## How the provider is chosen

`getStorage()` calls `resolveStorageMode(process.env)`, a pure function whose
rules are unit tested in `src/lib/storage.test.ts`, and caches the result for
the life of the process (`resetStorageCache()` exists for tests and scripts).
The rules, in order:

1. **All four `R2_*` variables set: R2.** In every environment.
2. **Production without them: refuse.** When `NODE_ENV` is `production` and
   the R2 configuration is missing or partial, the first storage call throws
   with a message naming the missing variables. Before this rule a production
   deploy with no bucket silently wrote every recording to the container disk,
   where the next deploy threw them away, and only a *partial* configuration
   produced so much as a warning. The throw is lazy (first `getStorage()`
   call, not import), so `next build` still succeeds; the first candidate
   upload or playback is what fails, with the reason in the log.
3. **`STORAGE_ALLOW_LOCAL=true` in production: local disk, with a warning on
   every start.** This is the operator saying "I know the recordings live on
   this disk" (a single VM with a persistent volume, for instance). The literal
   string `true` is the only accepted value. `AUTH_SECRET` must also be set,
   because local playback URLs are signed with it and the development default
   is public.
4. **`STORAGE_REQUIRE_R2` set anywhere else: refuse.** The pre-existing switch,
   kept for development and CI environments that want the production rule.
5. **Otherwise local disk.** A partial configuration still warns: three of the
   four variables set means somebody tried to configure R2 and mistyped one.
   The repository's own `.env` is in exactly this state today
   (`R2_BUCKET=kademe-media` and nothing else), so a warning is printed on the
   first `getStorage()` call in development.

What a production deploy therefore needs before it starts: either all four
`R2_*` variables, or `STORAGE_ALLOW_LOCAL=true` together with `AUTH_SECRET`.

## Abandoned uploads

A recording is uploaded part by part while it is being made and the
`media_assets` row sits in `UPLOADING` until the browser posts the completion.
When the tab dies mid answer that post never arrives. `salvageAbandonedUploads()`
in `src/lib/close-expired.ts`, run by `POST /api/cron/close-expired`, finishes
those on the server: an `UPLOADING` asset older than 30 minutes whose stage run
is closed, past its deadline, or missing, and whose run has had no heartbeat for
5 minutes, is assembled with the provider's `salvage()`. With parts it becomes
`INCOMPLETE` with its real size, is attached to the answer it was recorded for
(unless that answer already has a recording or was typed instead), and is
queued for transcription, exactly what the completion route does for a
recording the browser itself reported as cut short. With no parts it becomes
`FAILED`. The decision is `decideSalvage()` in `src/lib/stage-timeout.ts`, which
is pure and unit tested; the storage round trip is not, see below.

## What differs between the two implementations

|  | `LocalStorageProvider` | `R2StorageProvider` |
|---|---|---|
| `name` | `local` | `r2` |
| `minPartBytes` | `0` | `5 * 1024 * 1024` |
| `publicSignedUrls` | `false` | `true` |
| Where parts go | proxied through `PUT /api/c/[token]/media/part`, written to `<key>.parts.<uploadId>/` | browser PUTs a presigned URL straight to the bucket |
| `signPartUrls` | `{ url: "", proxy: true }` | a presigned `UploadPart` URL valid one hour, `proxy: false` |
| `getSignedUrl` | relative: `/api/media/local/<key>?expires=&sig=` (HMAC of key plus expiry) | absolute presigned `GetObject` URL |
| Serving playback | `GET /api/media/local/[...key]`, which parses `Range` and answers 206 | R2 serves the presigned URL itself, including ranges |
| Who knows which parts landed | the server, because it wrote them | the browser, which reports each part back over `POST .../media/part-done` |
| `completeUpload` | concatenates the part files by part number | `CompleteMultipartUpload`, reconciled against `ListParts` |
| `salvage` | reads whatever `.part` files are on disk and concatenates them | `ListParts`, then completes with what R2 is holding |
| `delete` | removes the file, then any parts directory for the same key older than an hour | `DeleteObject`, then aborts any multipart upload for the same key older than an hour |

`minPartBytes` is the difference that reaches the browser. The recorder produces
a chunk every five seconds and coalesces chunks until it has at least
`minPartBytes` before flushing a part (`src/lib/client/recorder.ts:119`), which
on local storage means every chunk goes out on its own and on R2 means roughly
5 MiB at a time. It is read from the provider and sent to the client by
`POST /api/c/[token]/exam/media/init` (`src/app/api/c/[token]/exam/media/init/route.ts:52`),
so nothing in the client assumes a value.

`publicSignedUrls` is the difference that reaches third parties. A local signed
URL is a path on this server and means nothing to anybody else, so the
transcriber posts the file bytes instead of a URL; with R2 it hands ElevenLabs a
fifteen minute signed URL and the bytes never pass through this process. That
branch is in `src/lib/transcription.ts:92` and currently tests
`storage.name === "r2"`; `publicSignedUrls` exists so it can test a capability
instead of a provider name.

## Bucket configuration R2 needs, which the code cannot do for you

The direct to bucket path only works if the bucket is configured for it. None of
this is verifiable from here.

1. **CORS.** The browser PUTs parts cross origin and then reads the `ETag`
   response header. `ETag` is not a CORS safelisted response header, so unless
   the bucket's CORS policy lists it under `ExposeHeaders` the browser reads an
   empty string, reports an empty etag, and `CompleteMultipartUpload` is
   rejected with `InvalidPart`. The policy needs `AllowedMethods: [PUT, GET]`,
   `AllowedOrigins` with the application origin, `AllowedHeaders: ["*"]` and
   `ExposeHeaders: ["ETag"]`.
   `R2StorageProvider.completeUpload` no longer depends on the browser getting
   this right (it asks R2 what it is holding), but playback and upload still
   need the origin allowed.
2. **The bucket must not be public.** Everything is read through a signed URL
   with a five minute lifetime for playback and fifteen minutes for
   transcription.
3. **A lifecycle rule for incomplete multipart uploads.** R2 keeps and bills for
   the parts of an upload that was never completed or aborted. `delete()` cleans
   up the uploads for a key it is deleting, but a recording that was abandoned
   and never reaches the retention job is only swept up by a bucket rule.
4. **Token permissions.** Object Read and Write is not quite enough on its own:
   `ListParts` and `ListMultipartUploads` are used by the reconciliation and the
   cleanup. Both are best effort, so a narrower token degrades rather than
   fails, but it degrades back into the silent truncation these exist to stop.

## Verifying

```bash
pnpm test                 # src/lib/storage.test.ts, LocalStorageProvider only
pnpm verify:r2            # the full R2 lifecycle against a real bucket
```

`scripts/verify-r2.ts` runs initUpload, two parts with the first over 5 MiB,
`listParts`, a `completeUpload` given deliberately blank etags (the CORS failure
above), a signed URL fetched over HTTP, a range request across the part
boundary compared byte for byte, `openStream` with and without a range, the
salvage path on an upload that was never completed, an abort, and a delete
followed by a confirmation that the object is gone and that deleting twice is
not an error. It writes one throwaway object under `verify/r2/` and removes it.

With no credentials it prints which variables are missing, says that nothing was
checked, and exits 1. It never reports a green result for an unrun check.

## What remains unproven

Everything below needs a human with a real bucket. None of it should be
described as working until `pnpm verify:r2` has been run and has passed.

- **Every R2 code path.** `src/lib/storage.test.ts` covers
  `LocalStorageProvider` and the pure helpers only. No test in this repository
  has ever executed an `@aws-sdk/client-s3` command against a server.
- **The presigned `UploadPart` URL as the browser uses it.** The script signs
  and uses part URLs through the SDK, not from a browser, so it does not test
  the bucket's CORS policy. That takes a real recording in a real browser.
- **The 5 MiB coalescing under a live recording.** The recorder reads
  `minPartBytes` from the server, which is checked, but the memory behaviour of
  holding 5 MiB on iOS Safari is not.
- **The review screen's five minute playback URL** against a recording longer
  than five minutes. A presigned URL that expires while a `<video>` is still
  seeking cannot recover on its own.
- **The retention job against a bucket.** `deleteObject` in `src/lib/retention.ts`
  treats a throw as a failure and keeps the row, which is right, but it has only
  ever been run against local disk.
- **The abandoned upload sweep against a bucket.** `salvageAbandonedUploads()`
  calls `R2StorageProvider.salvage()`, which is `ListParts` followed by
  `CompleteMultipartUpload`; both need the token permissions listed above.
  Only the selection rule has a test.

Related: `docs/PLAN.md` storage section, `docs/TRANSCRIPTION.md` provider
section.
