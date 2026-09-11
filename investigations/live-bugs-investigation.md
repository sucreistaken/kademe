# Investigation: Canlı ortamdaki iki hata (kayıt önizlemesi ve "Karar ver" linki)

## Hand-off Brief

1. **What happened.** İki bağımsız hata, ikisi de Confirmed: (a) aday kayıt sırasında kendi görüntüsünü görmüyor çünkü kamera düşünme ekranında açılıyor ve o ekranda `<video>` elementi yok, stream hiç bağlanmıyor; (b) puanlama ekranının son aşamasındaki "Karar ver" butonu `./decision` rotasına gidiyor, o rota hiç yazılmamış, 404.
2. **Where the case stands.** İki kök neden de kodda `path:line` ile doğrulandı. İkisi de tek dosyalık düzeltme.
3. **What's needed next.** (a) `MediaActivity` içinde video elementi monte olduğunda stream'i bağla; (b) "Karar ver" butonunu aday detay sayfasındaki karar bloğuna yönlendir.

## Case Info

| Field            | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| Ticket           | N/A (sözlü bildirim, 2026-09-11)                                           |
| Date opened      | 2026-09-11                                                                 |
| Status           | Concluded (ilk iki hata + 31 bulgu düzeltildi, tek commit)                  |
| System           | Kademe, Next.js App Router, canlı: kademe.kadiray.com (reverse proxy arkasında) |
| Evidence sources | kaynak kod (HEAD 73e2032), docs/PLAN.md, docs/STATUS.md, kullanıcı gözlemi |

## Problem Statement

Kullanıcı bildirimi (verbatim): "canlıda kullanıcı kayıt ederken test ederken sıkıntı yok sonraki
aşamalarda kendi kaydını göremiyor kaydederken. ama yönetici sayfasına düşüyor aslında kaydediyor.
ayrıca adayları değerlendirirken en son aşamada bu adayı değerlendir deyince falan sıkıntı cıkıyor
bir buga giriyor."

Okuma: (1) cihaz kontrolü ekranında kamera önizlemesi çalışıyor, asıl kayıt aşamalarında aday kendi
görüntüsünü görmüyor, ama kayıt yönetici tarafına düşüyor. (2) Puanlama ekranında son aşamada
"Karar ver" butonuna basınca hata.

## Evidence Inventory

| Source   | Status    | Notes     |
| -------- | --------- | --------- |
| Kaynak kod | Available | `src/components/candidate/activities/MediaActivity.tsx`, `src/components/review/review-screen.tsx`, `src/app/(manager)/candidates/[id]/` |
| Canlı log | Missing | Canlı sunucu logu yok; ikisi de istemci tarafı hata, log da bir şey söylemezdi |
| Yerel DB | Partial | Docker daemon kapalıydı, 5434 kapalı; canlı doğrulama için başlatıldı |
| Tarayıcı doğrulaması | Missing | Kamera otomasyon sekmesinden kanıtlanamaz (bkz. docs/STATUS.md), gerçek tarayıcı gerekir |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Kayıt önizlemesi neden siyah | High | Done | Finding 1 |
| 2 | "Karar ver" nereye gidiyor | High | Done | Finding 2 |
| 3 | Aynı kalıpta başka hata var mı (tsc, vitest, lint) | Medium | In Progress | Follow-up'ta |
| 4 | Gerçek tarayıcıda kamera önizlemesi | High | Blocked | Kullanıcı gerçek tarayıcıda 20 saniyede kontrol eder |

## Timeline of Events

| Time | Event | Source | Confidence |
| ---- | ----- | ------ | ---------- |
| a94ee27 | Platform tek commit'te yazıldı, `./decision` linki ve düşünme ekranı bu commit'te | git log | Confirmed |
| 73e2032 (2026-09-11 01:03) | Server Action origin ayarı, canlıya çıkış hazırlığı | git log | Confirmed |
| 2026-09-11 | Kullanıcı canlıda iki hatayı bildirdi | kullanıcı | Confirmed |

## Confirmed Findings

### Finding 1: Kamera stream'i, `<video>` elementi DOM'da yokken bağlanmaya çalışılıyor

**Evidence:** `src/components/candidate/activities/MediaActivity.tsx:106-111` (kamera THINKING fazında,
son 3 saniyede açılıyor), `:132-135` (`videoRef.current` varsa `srcObject` atanıyor, yoksa atlanıyor),
`:306-366` (THINKING fazının render dalı, içinde `<video>` yok), `:415-420` (`<video>` yalnızca
RECORDING/UPLOADING/DONE dalında), `:151` (efekt bağımlılıkları `phase` içermiyor, bilerek).

**Detail:** `getUserMedia` her zaman THINKING fazında çözülüyor (ısınma ya da "Şimdi başla").
O anda `videoRef.current === null`, `srcObject` ataması atlanıyor. Faz RECORDING'e geçince video
elementi monte oluyor ama stream'i ona bağlayan hiçbir kod yok. MediaRecorder aynı stream'den
kayıt yapıyor, yükleme çalışıyor, yönetici videoyu görüyor. Aday ise siyah kutu görüyor.
Deterministik: her video aktivitesinde, her tarayıcıda.

Cihaz kontrolü ekranında çalışmasının sebebi: `src/components/candidate/DeviceCheck.tsx:227-232`
video elementi her zaman render ediliyor, `:102-104` atama yapıldığında element mevcut.

### Finding 2: "Karar ver" butonu var olmayan `/candidates/[id]/decision` rotasına gidiyor

**Evidence:** `src/components/review/review-screen.tsx:523` (`<a href="./decision">`),
`src/app/(manager)/candidates/[id]/` dizini yalnızca `page.tsx` ve `review/` içeriyor (`find src/app
-ipath "*decision*"` boş), `docs/PLAN.md:314` (`/decision` rotası planlanmış ama yazılmamış),
`src/app/(manager)/candidates/[id]/page.tsx:256-262` (karar formu aday detay sayfasında yaşıyor).

**Detail:** `/candidates/<id>/review` sayfasında göreli `./decision`, `/candidates/<id>/decision`
adresine çözülüyor. Bu rota yok, Next 404 veriyor. Buton yalnızca son aşamada ve tüm aşamalar
puanlandığında aktif, bu yüzden "en son aşamada" görülüyor. Karar özelliği aslında aday detay
sayfasında (`saveDecision` server action) tam çalışır halde.

## Deduced Conclusions

### Deduction 1: Canlı ve yerel arasında fark yok, hata her ortamda aynı

**Based on:** Finding 1, Finding 2

**Reasoning:** İki hata da ortam değişkenine, proxy'ye ya da HTTPS'e bağlı değil; render sırası ve
dosya sistemi rotasından kaynaklanıyor.

**Conclusion:** "Canlıda çıktı" gözlemi, canlıda ilk kez gerçek uçtan uca kullanılmasından
kaynaklanıyor. docs/STATUS.md zaten kamera yolunun otomasyondan hiç doğrulanamadığını yazıyor.

## Hypothesized Paths

### Hypothesis 1 (kullanıcı hipotezi): Kayıt canlıda kaydedilmiyor

**Status:** Refuted

**Resolution:** Kullanıcının kendi gözlemiyle çürüdü ("yönetici sayfasına düşüyor"), kod da bunu
destekliyor: MediaRecorder ve yükleyici `streamRef` üzerinden çalışıyor, video elementinden bağımsız.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| Gerçek tarayıcıda önizleme | Düzeltmenin çalıştığının kanıtı | Gerçek Chrome'da bir aday linkiyle video aktivitesine gir, kayıt sırasında kendini gör |

## Source Code Trace

| Element | Detail |
| ------- | ------ |
| Error origin | (1) `MediaActivity.tsx:132` atlanan `srcObject` ataması; (2) `review-screen.tsx:523` `./decision` |
| Trigger | (1) Kameranın THINKING fazında açılması; (2) Son aşamada tüm puanlar verilince butona basmak |
| Condition | (1) `videoRef.current === null` iken `getUserMedia` çözülüyor; (2) Rota dosyası yok |
| Related files | `StageRunner.tsx`, `DeviceCheck.tsx`, `candidates/[id]/page.tsx`, `candidates/[id]/review/page.tsx` |

## Conclusion

**Confidence:** High

İki kök neden de Confirmed ve deterministik. Düzeltme yönü aşağıda.

## Recommended Next Steps

### Fix direction

1. `MediaActivity`: video elementi monte olduğunda (faz değişince) `streamRef.current`'ı
   `srcObject`'e bağlayan bir efekt ekle. Kamera efektine dokunma, `phase` bağımlılığı bilerek yok.
2. `ReviewScreen`: `decisionHref` prop'u al, `review/page.tsx` `/candidates/${id}#decision`
   versin; aday detay sayfasındaki karar başlığına `id="decision"` ekle.

### Diagnostic

Gerçek tarayıcıda: `pnpm dev:link "Test Aday"`, video aktivitesine gir, kayıt sırasında kendini gör.

## Reproduction Plan

1. Herhangi bir video aktivitesi olan aday linkiyle gir, düşünme süresi bitsin: kayıt ekranı siyah.
2. Tüm aşamaları puanla, son aşamada "Karar ver": 404.

## Side Findings

- `useT` next-intl `useTranslations` döndürüyor, memoize; kamera efektinin `t` bağımlılığı
  stream'i yeniden açtırmıyor (Confirmed, `src/i18n/candidate-client.ts:35`).
- Yerel Docker daemon kapalıydı; 3100'deki dev sunucusu DB'siz çalışıyordu.

## Follow-up: 2026-09-11

### Applied fixes (uncommitted)

- `src/components/candidate/activities/MediaActivity.tsx`: yeni bir `useEffect`, `[phase, streamReady, isAudio]`
  değişince `videoRef.current.srcObject = streamRef.current` bağlıyor. Kamera efekti değişmedi.
- `src/components/review/review-screen.tsx`: `decisionHref` prop'u, `./decision` yerine kullanılıyor.
- `src/app/(manager)/candidates/[id]/review/page.tsx`: `decisionHref={`/candidates/${id}#decision`}`.
- `src/app/(manager)/candidates/[id]/page.tsx`: karar başlığına `id="decision"` ve `scroll-mt-6`.

### Verification

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` (4 dosya) | exit 0 |
| `npx vitest run` | 11 dosya, 194 test geçti |
| Yerel `/candidates/<id>/review` | 200 |
| Yerel `/candidates/<id>/decision` (eski hedef) | 404, hata buydu |
| Yerel `/candidates/<id>` HTML'inde `id="decision"` | var |
| Aktif "Karar ver" linkinin render edilmiş HTML'i | Geçici render testiyle doğrulandı (tek aşama, tüm puanlar dolu): `<a href="/candidates/abc#decision">Karar ver</a>`, `./decision` yok; puansız fixture'da span. Test dosyası silindi |
| Kamera önizlemesi gerçek tarayıcıda | GÖRÜLMEDİ: otomasyon sekmesinden kanıtlanamaz, kullanıcı kontrol etmeli |

### Updated Conclusion

İki kök neden Confirmed, düzeltmeler derleniyor ve testler geçiyor. Kamera düzeltmesinin kanıtı
gerçek tarayıcıda 20 saniyelik bir denemeye bağlı.

## Follow-up: 2026-09-11 #2 (geniş tarama: "olası diğer buglar")

Yöntem: üç paralel salt-okunur ajan (aday akışı, yönetici paneli, sunucu/API/cron) + ölü link taraması.
Her ajanın ilk sıradaki bulguları parent tarafından satır satır yeniden okunarak doğrulandı (aşağıda "P" işareti).
Hiçbir dosya düzenlenmedi. Canlı tarayıcı koşusu yapılmadı. Derece: Confirmed = kod yolu uçtan uca izlendi;
Likely = bir halka doğrulanmadı, hangisi olduğu yazılı.

### Öncelik 1: veri kaybı / yanlış karar riski

| # | Bulgu | Kanıt | Derece |
|---|-------|-------|--------|
| A1 | Canlıda R2 değişkenleri yoksa medya sessizce konteyner diskine yazılıyor, uyarı yok | `src/lib/storage.ts:721-745`; `.env.example`'da `STORAGE_REQUIRE_R2` yok | Confirmed (P). Canlıda R2 anahtarlarının girili olup olmadığı BİLİNMİYOR |
| A2 | Ağırlıklar hiçbir ekranda uygulanmıyor, hep `overallScore(..., null)` | `src/lib/manager-data.ts:355-361`; `weights/actions.ts:258` yazdığı `evaluations.overallScore`'u kimse okumuyor | Confirmed (P) |
| A3 | İkinci değerlendirici inceleme sayfasını açınca boş evaluation satırı ekleniyor; listeler attempt başına tek satır tutan Map ile rastgele birini seçiyor, skorlar "-" görünebilir | `src/server/review.ts:242-246`; `src/lib/manager-data.ts:298,319` | Confirmed (P); hangi satırın kazandığı sıraya bağlı (Likely) |
| A4 | Aynı aday iki pozisyondaysa `/candidates/[id]` ilk bulduğu assessment'ı açıyor; karar formu yanlış pozisyona yazabilir | `src/lib/manager-data.ts:486` (`rows.find`), `candidates/page.tsx:283`, `compare/page.tsx:129` | Confirmed (ajan) |
| A5 | `saveDecision` / `undoDecision` org sahipliği kontrol etmiyor | `src/app/(manager)/actions.ts:104-135, 142-178` | Confirmed (P) |
| A6 | Süre dolunca otomatik gönderim: zorunlu soru boşsa sunucu 5 sn slack içinde 422 döner, istemci `auto` dalında hatayı yutar, aday 0:00'da kilitli kalır; sunucuda süpürücü yok | `StageRunner.tsx:102-116`, `stage/submit/route.ts:31-49`, `src/lib/timer.ts:44-51` | Confirmed (P) |
| A7 | Metin cevabında son 800 ms'lik debounce flush edilmeden gönderim atılıyor; son yazılanlar kaybolur ya da 422 | `StageRunner.tsx:102-109`, `activities/shared.tsx:35-53` | Confirmed (ajan) |
| A8 | FILE_UPLOAD dosyaları (PDF vb.) `video/webm` olarak saklanıp transkripsiyona giriyor | `src/lib/candidate-media.ts:22-36`, `media/init/route.ts:40-41`, `media/complete/route.ts:59-61` | Confirmed (ajan) |

### Öncelik 2: işlev yanlış çalışıyor

| # | Bulgu | Kanıt | Derece |
|---|-------|-------|--------|
| B1 | Tam puanlanan aday hiç "Puanlandı" olmuyor: `evaluations.submittedAt` seed dışında hiç yazılmıyor | `src/lib/manager-data.ts:116`; repo genelinde yazan yok | Confirmed (P) |
| B2 | Kısmi retake sonrası aday detayı taşınan aşamaların cevaplarını göstermiyor (review ekranı gösteriyor) | `manager-data.ts:504-528` vs `retake.ts:151-162`, `review.ts:145-148` | Confirmed (ajan) |
| B3 | Süresi dolmuş linkte retake `ok: true` döner ama link EXPIRED kalır | `src/server/retake.ts:173-190` | Confirmed (P) |
| B4 | Tarayıcı kayıt ortasında ölürse asset sonsuza kadar UPLOADING; `salvage()` uygulama kodundan hiç çağrılmıyor; inceleme sayfası kırık URL üretir | repo genelinde `\.salvage(`: yalnızca `scripts/verify-r2.ts`, sınıf içi sarmalayıcı ve testler; `review/page.tsx:104-110` | Confirmed (P) |
| B5 | close-expired sorgusu ALLOW_LATE koşularını dışlamıyor, ORDER BY yok; 50'yi geçince diğerleri hiç kapanmaz | `src/lib/close-expired.ts:50-56` | Confirmed (P) |
| B6 | maxTakes sunucuda kontrol edilmiyor, istemci `takes` her mount'ta 0; F5 ile sınırsız tekrar çekim | `media/init/route.ts` (maxTakes geçmiyor), `MediaActivity.tsx:79` | Confirmed (P) |
| B7 | "Şimdi başlat" yolunda `beginRecording` her 200 ms tick'te yeniden çağrılıyor, in-flight koruması yok; birden fazla MediaRecorder ve asset | `MediaActivity.tsx:184-189` (deps `thinkLeft`), `:239-272` | Confirmed (P) |
| B8 | "Şimdi başlat" ile başlayan cevap DONE olunca kamera açık kalıyor (`startRequested` true) | `MediaActivity.tsx:106-111` | Confirmed (P) |
| B9 | Retake'te `thinkLeft=0` 200 ms sonra tam süreye geri yazılıyor; kamera yanıp sönüyor, düşünme süresi yeniden işliyor | `MediaActivity.tsx:282-289, 173-180` | Confirmed (ajan); FAILED'e düşme kısmı Likely |
| B10 | FAILED fazından çıkış yok, ipucu "Kayıt hazırlanıyor." yazıyor | `MediaActivity.tsx:501-518` | Confirmed (ajan) |
| B11 | Kayıt sürerken "yazarak cevaplayayım" tıklanınca yarım klip nihai cevap oluyor | `MediaActivity.tsx:533-541, 141-147` | Likely (track stop → onstop tarayıcıda koşulmadı) |
| B12 | Eski sekme/cihaz bir sonraki aşamanın aynı index'li sorusuna yazıyor | `response/route.ts:36-47`, `candidate-flow.ts:849-854`, `media/complete/route.ts:64-80` | Confirmed (ajan); complete kısmı Likely |
| B13 | REVIEWER rolüne görünen linkler (davet, uzat, ağırlık, skala) `ForbiddenError` fırlatıyor, `error.tsx` yok, jenerik hata ekranı | `src/server/session.ts:17-22`; `find src/app -name error.tsx` boş | Confirmed (ajan) |
| B14 | Saklama çapası herhangi bir karar satırını (IN_REVIEW dahil) ya da davet tarihini kullanıyor; silme açılırsa inceleme süren adayın videosu gidebilir | `src/lib/retention.ts:299-322` | Confirmed (ajan). Silme bugün kapalı |
| B15 | Cron stage-run güncellemesinde PENDING/unsubmitted guard'ı yok; slack içinde gönderen adayın koşusu PARTIAL + late işaretlenebilir | `close-expired.ts:109-116` vs `candidate-flow.ts:509-512` | Confirmed (ajan), pencere dar |

### Öncelik 3: küçük / kozmetik / Likely

| # | Bulgu | Kanıt | Derece |
|---|-------|-------|--------|
| C1 | Aday detayında ikinci aşama açık geliyor (`orderIndex === 1`, index 0 tabanlı) | `candidates/[id]/page.tsx:461` | Confirmed (P) |
| C2 | Retake revalidatePath assessment id ile, rota candidate id ile | `retake.ts:215, 259` | Confirmed uyuşmazlık; görünür etkisi kurulamadı |
| C3 | Builder autosave sonrası `router.refresh()` yerel düzenlemeyi eziyor olabilir (STATUS'taki "aşama adı kaydı" şüphesiyle ilişkili olabilir) | `builder-screen.tsx:240-244, 286-303` | Likely |
| C4 | Transkripsiyon: öldürülen job `active` kalır, `stately` politika aynı anahtarı bloklar; `boss.supervise()` çağrılmıyor | `src/lib/queue.ts:38-49`, `cron/transcribe/route.ts:52-74` | Likely |
| C5 | `db:setup` `push --force` ile; prod'a doğrultulursa onaysız veri kaybı | `package.json:16` | Likely |
| C6 | Denetim CSV tarih filtresi sunucu saat dilimiyle | `src/server/settings.ts:173-188` | Likely (canlı TZ bilinmiyor) |
| C7 | `secondsAgo/justNow` koşulu ters | `activities/shared.tsx:74-76` | Confirmed (ajan) |
| C8 | Sorun bildirimi e-postası ADAYA gidiyor (`toEmail`), Mailer bağlanınca ekibe ulaşmaz | `problem/route.ts:29` | Confirmed (ajan), bugün etkisiz |

### Checked and clean (ajan raporlarından)

i18n anahtarları (tipli `useT`/`useMT`, tr/en kümeleri eşit, `messages.test.ts` geçiyor); cron auth; oturum çerezleri;
setup-token akışı; yerel medya rotası path kontrolü; R2 ETag/ListParts; part upload sırası; pg-boss idempotent kuyruk;
retake transaction'ı; drizzle/sql ile şema uyumu; `allowedOrigins`; timer/stage-timeout matematiği; review klavye kısayolları;
`saveEvaluationItem` şeması; davet formu; useStageClock; heartbeat/event/bandwidth/rights/consent/info rotaları.

### Updated Conclusion

İlk vaka (iki canlı hata) Concluded. Bu takip taraması 31 ek bulgu çıkardı; 10'u parent tarafından satır satır yeniden
doğrulandı, kalanlar ajan izleme raporuna dayanıyor ve `path:line` taşıyor. Hiçbiri düzeltilmedi. En yüksek riskli
tekil soru: canlıda R2 anahtarları girili mi (A1). Cevap hayırsa canlıdaki her video bir sonraki deploy'da kaybolur.

## Follow-up: 2026-09-11 #3 (düzeltmeler uygulandı)

Üç paralel implementasyon ajanı, dosya sahipliği ayrık. Birleşik ağaçta parent doğrulaması:

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | 15 dosya, 258 test geçti (öncesi 11 dosya, 194) |
| `npx eslint` (değişen tüm ts/tsx) | exit 0 |
| Uzun tire taraması (değişen dosyalar) | 0 |
| `pnpm verify:candidate` (yeni `stagePosition` kuralıyla güncellendi) | ALL CHECKS PASSED |
| Yönetici sayfaları curl (dashboard, candidates, compare, library, positions, settings, audit, detay?assessment=, review) | hepsi 200 |
| `POST /api/cron/close-expired` | çalıştı, yeni `uploads` bölümü raporda |

Düzeltilmeyen / kapsam dışı bırakılan: yok. Gerçek tarayıcı kanıtı olmayanlar STATUS.md'de listeli.
Canlıda R2 anahtarlarının varlığı hâlâ bilinmiyor; SSH bu oturumdan engellendi, komut kullanıcıya verildi.
