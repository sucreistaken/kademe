# Kademe - durum ve devir belgesi

Son güncelleme: 2026-09-09 (ikinci tur). Bir oturum sıfırlandığında buradan devam edilir.

## Ürün tek cümlede

Yönetici bir pozisyon için aşamalı ve süreli bir değerlendirme kurar, adaya kişisel link
gider, aday video ve yazılı cevapları tek başına doldurur, yönetici tek ekranda izleyip
yetkinlik bazlı puanlar ve kararı kendisi verir. AI kimseyi elemez.

Tam mimari: `docs/PLAN.md`. Tasarım kuralları: `docs/design/RULES.md`.
Tasarım kaynağı: `docs/design/kademe-canvas.html` (Claude Design canvas, 12 artboard:
Y1-Y7 yönetici, A8-A12 aday). i18n yapısı: `docs/I18N.md`.

## Çalıştırma

```bash
docker compose up -d          # Postgres, port 5434 (5433 başka projede dolu)
pnpm db:setup                 # drizzle push + drizzle/sql/*.sql. SADECE push YETMEZ.
                              # 2026-09-09: templates.archived_at eklendi, eski bir
                              # veritabaninda `pnpm db:push` gerekir.
                              # pg-boss ilk çalışmada kendi "pgboss" şemasını açar,
                              # uygulama tablolarına dokunmaz, seed'in TRUNCATE'i etkilemez.
pnpm db:seed                  # demo veri. DİKKAT: TRUNCATE ile başlar, her şeyi siler.
pnpm dev --port 3100          # 3000 başka projede dolu
```

AI sağlayıcısı: `AI_PROVIDER` boşsa anahtarı olan kullanılır, ikisi de varsa NVIDIA
(ücretsiz). Ayrıntı ve model notları: `docs/AI-BUILDER.md`.

Yönetici girişi: `kadiraycareer@gmail.com` / `kademe-dev-2026`
Taze aday linki: `pnpm dev:link "Ayşe Demir"`
Aday akışı doğrulaması: `pnpm verify:candidate <token>`
Panel ekranını script'ten görmek: `curl -s -H "Cookie: $(npx tsx scripts/dev-session.ts)" \
  localhost:3100/dashboard`. Panel auth arkasında ve login formu her derlemede
değişen bir server action id'si postluyor, yani curl ile formdan geçmek çıkmaz sokak.
Dili çerez seçer: `kademe-lang=en`.

## Bitmiş ve doğrulanmış

Hepsi gerçek Chrome'da tıklanarak test edildi, sadece derlenmiş değil.

| Alan | Durum |
|---|---|
| Şema, 35 tablo | bitti |
| Yönetici auth + rol kapasiteleri | bitti |
| Y1 dashboard, Y4 aday tablosu, Y6 karşılaştırma, Y7 aday detay | bitti |
| Aday davet + link üretme | bitti |
| /library yetkinlik kütüphanesi + skala | bitti |
| Y5 inceleme ve puanlama (kritik ekran) | bitti |
| Ağırlık ekranı + yeniden hesaplama | bitti |
| Aday akışı A8-A12, tüm aktivite tipleri | bitti |
| Video kayıt hattı, parçalı yükleme | bitti |
| Erişilebilirlik yedeği (video yerine yazılı) | bitti |
| Aday tarafı TR+EN | bitti |
| Y2 şablon builder (yan yana iki sütun, koyu yönetici paneli) | bitti |
| Y5 canvas eşitliği (özel oynatıcı, gezinme, geçmiş, kırpma) | bitti |
| Retake akışı (kapsam seçmeli, taşımalı) | bitti |
| close-expired ve expire-links cron'ları | bitti |
| Transkripsiyon hattı (pg-boss + cron + ElevenLabs Scribe) | bitti, gerçek Scribe çağrısıyla doğrulandı |
| Pozisyon ekranları (liste, yeni, detay, şablon versiyonları) | bitti |
| Y2 şablon builder (sürükle-bırak, A/Y ayrımı, yayınlama) | bitti |
| Aday önizlemesi | bitti, sızıntı yokluğu HTML araması ile kanıtlandı |
| Y3 AI builder (ilan -> öneri kartları) | bitti, NVIDIA nemotron ile gerçek koşuda doğrulandı |
| AI builder'a giriş yolu | bitti, pozisyon açma akışının içinde, gerçek tarayıcıda tıklanarak doğrulandı |
| Gemini sağlayıcısı (`gemini-3.6-flash`) | bitti, gerçek istemle 20-35 sn, NVIDIA yedeğe düşme dahil |
| Şablon adı değiştirme + arşivleme | bitti, rename/archive/restore tarayıcıda denendi, denetim kaydına düşüyor |
| Üç adımlı şerit (İçerik · Gözden geçir · Yayınla) | bitti, üç ekranda da |
| Davet dili seçimi | bitti, İngilizce davet uçtan uca doğrulandı (e-posta + aday ekranı) |
| İki dilli içerik yazımı (builder TR/EN) | bitti, iki yarı ayrı kaydediliyor |
| Panelden kullanıcı davet etme (`/setup/[token]`) | bitti, parola belirleme adımı hariç doğrulandı |
| Giriş ekranı TR+EN | bitti |
| Aşama adı düzenleme (iki dilli) | yazıldı, otomatik kaydı doğrulanamadı, aşağıya bak |
| Denetim kaydı CSV dışa aktarımı | bitti, BOM + CRLF + formül enjeksiyonu kaçışı doğrulandı |
| `retake.ts` ve `template-draft-job.ts` hataları koda çevrildi | bitti, sabit Türkçe kalmadı |
| Panel tarafı TR+EN | bitti, 14 rota iki dilde 200, ham anahtar sızmıyor |
| /settings ve /settings/audit | bitti, owner olarak render doğrulandı |
| Saklama raporu (`purge-retention`) | bitti ama SİLME KAPALI, aşağıya bak |
| R2 denetimi ve doğrulama scripti | kod hazır, bucket olmadan doğrulanamaz |

## Saklama silme: kapalı, bilerek

`purge-retention` yazıldı ve raporluyor, ama hiçbir şeyi silmiyor. Açmak için İKİSİ
birden gerekir, ikisi de hiçbir yerde ayarlı değil:

1. ortamda `RETENTION_PURGE_ENABLED=true`
2. istekte `?apply=1`

Tek başına hiçbiri yetmez, `runRetention()` parametresiz çağrıldığında tek bir
denetim satırı bile yazmayan saf bir okumadır. Silmeyi açmadan önce yapılacak iki
kontrol: `responses.payload.mediaAssetId` bir foreign key değil, jsonb, yani medya
silindiğinde sarkan bir id kalıyor ve Y5 inceleme ekranının bunu "medya yok" diye
karşıladığı doğrulanmalı; bir de `media_assets.storage_key` "pending" kalabildiği
için retention'ın `media/` ile başlamayan anahtarları atlaması gerekiyor.

Ölçüm: bugün her şey sıfır, en eski veri Ağustos 2026 ve kimse 180 güne ulaşmadı.
Sıfır rapor bir şey kanıtlamadığı için `scripts/verify-retention.ts` aynı sorguları
`now` 1200 gün ileri itilmiş halde de koşuyor: 23/23 medya, 24/24 aday eşleşiyor.

## AI sağlayıcısı: Gemini birincil, NVIDIA yedek

`AI_PROVIDER` boşsa sıra `gemini ?? nvidia ?? openrouter`. Gemini'nin denemeleri
tükenirse ve NVIDIA anahtarı varsa çağrı bir kez NVIDIA ile tekrarlanır, ve ekran
bunu söyler (`aiBuilder.fellBackTo`); sessizce dakikalarca bekletmez.

Ölçülen süreler, gerçek istem ve gerçek şemayla, beş koşu: 29.3, 27.4, 23.4, 20.1,
35.3 saniye. Girdi 1209 token, çıktı 3421-5458. NVIDIA'da aynı iş 131-275 saniyeydi.
Beş koşuda iki kez 503 çıktı, yeniden deneme ikisini de yuttu. Yanlış model adı
0.87 saniyede düştü, tek `ai_runs` satırı, yeniden deneme yok.

`gemini-2.5-flash` yeni kullanıcılara kapalı, 404 ile "artık kullanılamıyor" diyor.
OpenCode Zen denendi ve elendi: ücretsiz katman sadece OpenCode istemcisinin içinde
çalışıyor, ücretli tarafta ödeme yöntemi yok.

## İlan metni eşiği

Sert sınır 40 karakter, sadece iş unvanının tek başına geçmesini engellemek için.
120 karakter engel DEĞİL, sadece "metin kısa, öneriler kabaca çıkabilir" uyarısı.
İki kısa Türkçe cümle 98 karakter, ve onu engellemek çıkmaz sokak olurdu.

## R2: kod hazır, bucket yok

`src/lib/storage.ts` içindeki R2StorageProvider dört değişken (`R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`) tamamsa devreye giriyor. Üçü var
biri yoksa artık sessizce diske düşmüyor, uyarıyor. Ayrıntı: `docs/STORAGE.md`.

Anahtarlar gelmeden R2 yolu DOĞRULANMAMIŞTIR. `pnpm verify:r2` şu an exit 1 verip
"hiçbir şey kontrol edilmedi" diyor. Geçmeden önce insanın sağlaması gerekenler:

- `ListParts` ve `ListMultipartUploads` yetkisi olan bir token, sadece okuma/yazma değil
- bucket CORS'unda **`ExposeHeaders: ["ETag"]`**. Bu olmazsa tarayıcının doğrudan
  PUT'unda ETag okunamıyor, `CompleteMultipartUpload` `InvalidPart` ile reddediyor ve
  **her video cevabı kaybolur**. Kod artık parça listesini R2'ye sorup bunu telafi
  ediyor, ama engellenen bir PUT'u kurtaramaz.
- yarım kalan multipart yüklemeleri iptal eden bir lifecycle kuralı

## Yapılmayanlar

- **Builder'da aşama alanlarının otomatik kaydı doğrulanamadı.** Aşama adı ve
  aşama süresi `onBlur` ile kaydediyor; otomasyon sekmesinde iki denemede de
  veritabanına yazmadı, ama `updateStage`'in sunucu tarafı doğrudan sınandı ve
  çalışıyor (`versionOfStage` çözüyor, durum DRAFT, yazma ve geri alma başarılı),
  ve aynı ekrandaki tıklamaya bağlı kayıtlar (dil seçici) çalışıyor. Yani ya
  otomasyonun ürettiği blur React'e ulaşmıyor ya da builder'ın aşama otomatik
  kaydı hiç çalışmıyor. Gerçek tarayıcıda 20 saniyede belli olur: bir aşamanın
  adını değiştir, başka yere tıkla, sayfayı yenile. Ad durursa sorun yok.
  Aşama adına Enter ile kaydetme de eklendi ama O DA ÇALIŞTIRILMADI: kod
  derleniyor, tarayıcıda hiç denenmedi. Yani şu an blur yolu da Enter yolu da
  kanıtsız. Aşama süresi alanının çalışmadığı saptaması da yalnızca otomasyon
  sekmesinden geliyor, gerçek tarayıcıda hiç denenmedi.
- `/setup/[token]` ekranında parola belirleme adımı gerçek tarayıcıda hiç
  çalıştırılmadı: argon2 yazımı, `used_at` damgası, `user.setup_complete` denetim
  satırı ve oturum çerezi kanıtlanmadı. GET tarafı doğrulandı.

## Üç oturum aynı repoda: bilinen tuzaklar

1. **Hot reload uzun süren sunucu aksiyonlarını öldürür.** Biri dosya
   kaydettiğinde Next yeniden derliyor ve o sırada süren bir server action
   kopuyor. Dört dakikalık bir AI çağrısı ve bir retake testi böyle yarıda
   kaldı. Uzun bir test koşmadan önce diğerlerine haber ver.
2. **Yarım yazılmış tek bir dosya bütün rotaları 500 yapar.** Turbopack derleme
   hatasını her sayfaya yayıyor. Kendi kodunda hata arama, önce `npx tsc
   --noEmit` çalıştırıp hatanın kimde olduğuna bak.
3. **`pnpm db:seed` her şeyi TRUNCATE eder.** Çalıştırmadan önce haber ver.

## Bozulmaması gereken değişmezler

Bunlar veritabanı seviyesinde zorunlu kılındı, `drizzle/sql/` altında. Kod kuralı değiller.

1. **Yayınlanmış şablon versiyonu değişmez.** `0001_immutability.sql`. Aşama, aktivite
   ekleme/düzenleme/silme ve versiyonu silme reddedilir. Düzenlemek yeni DRAFT açmaktır.
   Seed bu yüzden önce DRAFT yazar, en son PUBLISHED'a çevirir.
2. **Assessment başına en fazla bir aktif link.** `0002_single_active_link.sql`.
   Link yenilemek için önce eskisini EXPIRED yapmak ZORUNLU. Retake aynı linki kullanır.

Kodda korunan diğer kurallar:

3. **Süre otoritesi sunucuda, duvar saati.** `src/lib/timer.ts`, 13 test. `deadline_at`
   aşama başlarken bir kere yazılır. F5 süreyi ne sıfırlar ne uzatır, sekme kapatmak
   bedava süre kazandırmaz.
4. **`internal_*` alanları aday API'sinden asla çıkmaz.** `src/lib/candidate-safe.ts`.
   İsim kalıbına güvenmek YETMEZ: `config.choices[].correct` cevap anahtarıydı ve
   kalıba uymadığı için sızıyordu. Strip listesi var, `verify:candidate` her koşuda
   tüm yanıt gövdelerini tarıyor.
5. **AI adayı puanlamaz, sıralamaz, duygu okumaz.** Sadece üç kullanım: şablon taslağı,
   transkripsiyon, yöneticinin KENDİ notlarının özeti. Videodan duygu çıkarmak AB AI
   Act'te yasaklı uygulama. `ai_purpose` enum'unda karşılığı bilerek yok.
6. **Otomatik puanlanan sorular yetkinlik ortalamasına karışmaz.** Ayrı "Bilgi Skoru".
7. **Değerlendirme değişiklikleri iz bırakır.** Puanlama ekranı sessizce
   kaydediyor, hız oradan geliyor; `evaluation_item_revisions` tablosu da bu
   yüzden var. Bir puanın ne zaman ve kim tarafından değiştiği aylar sonra
   sorulabilir olmalı.
8. **Ağırlık değişikliği geçmiş skorları değiştirmez.** Yeni `weight_set` açılır, eski
   skorlar eski sete bağlı kalır. Yeniden hesaplama ayrı ve açık bir aksiyon.

## Tasarım kuralları (kısa)

Tam liste `docs/design/RULES.md`. En sık ihlal edilenler:

- Tek vurgu rengi `#0E6A57`, sadece üç yerde: birincil CTA, aktif durum, süre sayacı.
  Kart kenarlığı ve ikincil buton asla renkli değil. Ekranda tek dolu düğme.
- Durum = nokta + metin, rozet yok.
- "Emin misiniz?" diyaloğu yok, 8 saniyelik geri al şeridi var. `alert`/`confirm` yasak.
- Pasif düğme her zaman nedenini yazar (`DisabledReason`).
- Çıkmaz sokak yok: boş liste ve sıfır sonuç bile sonraki adımı gösterir.
- `Button` varsayılan `type="button"`. Submit istiyorsan açıkça yaz.
- Veritabanından gelen metni CSS ile uppercase ETME ("Kıdemli" -> "KIDEMLI").
- Türkçe olmayan metin taşıyan alt ağaca `lang` attribute'u koy, yoksa
  `text-transform` Türkçe i/İ kuralını uygular ("WRİTTEN ANSWER").

## DOĞRULANAMAYAN İKİ ŞEY, üstü örtülmesin

Bunlar bu ortamda kanıtlanamıyor, "çalışıyor" diye raporlanmamalı.

1. **Video oynatma.** Otomasyon sekmesi medya çözmüyor. Kanıt zinciri: curl ile
   uç nokta doğru (200 + content-length + accept-ranges, `Range: bytes=0-` ->
   206 ve tüm baytlar), sayfa içinden `fetch` 206 dönüyor, ama `<video>`
   `readyState 0` / `networkState 2` / hata yok halinde takılıyor. Dosyayı
   tamamen belleğe alıp blob olarak verdiğimde bile aynı, yani ağ ve sunucu
   eleniyor. Chrome'un kendi oynatıcısında da aynı.
2. **Kamera ile gerçek video kaydı.** Elimizdeki profilde kamera izni yok.

İkisi de normal bir tarayıcıda bir dakikada kontrol edilebilir.

## Doğrulama

```bash
npx tsc --noEmit      # temiz olmalı
npx eslint src        # temiz olmalı
pnpm test             # 194 test, 11 dosya
pnpm verify:candidate <token>
pnpm verify:r2        # bucket yoksa exit 1, "hiçbir şey doğrulanmadı"
npx tsx scripts/verify-retention.ts   # kuru koşu, hiçbir şey silmez
```

Uçtan uca test Playwright ile DEĞİL, Claude in Chrome ile gerçek tarayıcıda yapılıyor.
Kullanıcı kararı.

## Transkripsiyon

`docs/TRANSCRIPTION.md`. pg-boss dayanıklı depolama olarak, `POST /api/cron/transcribe`
drenaj olarak kullanılıyor (Cloud Run sıfıra ölçeklendiği için ayakta duran worker yok).
Başarısız transkripsiyon HİÇBİR ŞEY yazmaz: satır yok, placeholder yok, yaklaşık metin yok.
Her çağrı başarılı da başarısız da `ai_runs`'a düşer.

Seed'in ürettiği webm'ler ffmpeg'den çıkma sessiz kliplerdir, içlerinde konuşma yoktur.
Anlamlı bir transkripsiyon testi için aday akışından gerçek bir video cevabı ver, ya da
macOS `say` ile konuşma üret.

**ELEVENLABS_API_KEY `sk_` ile başlamalı.** ElevenLabs panelinde anahtarın yanında bir de
"API key ID" görünüyor; o ID ile çağrı yapılamaz, sunucu
`api_key_id_used_as_api_key` hatası döner. Doğrulanmış çağrı: 11 saniyelik Türkçe ses,
1880 ms, 19 kelime, dil otomatik `tur` algılandı, maliyet 0,000655 USD
(saatlik yaklaşık 0,21 USD).

## Bilinen veri hataları

- Seed'in iki `weight_set`'i de toplam %100.02 (6 x 16.67). Ağırlık ekranındaki
  "Eşit dağıt" düğmesi düzeltiyor. Seed'i güncellerken `evenWeightSplit()` kullan.
