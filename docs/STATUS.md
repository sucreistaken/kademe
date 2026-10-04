# Kademe - durum ve devir belgesi

Son güncelleme: 2026-10-04 (çekirdek ayrımı `platform/solutions` dalında, yerelde doğrulandı;
canlıya çıkmadı). **Canlıda**: https://kademe.kadiray.com, commit `3f2b8a8`
(`main`). Canlı veritabanı kullanıcı onayıyla sıfırlandı: eski işe alım verisi yok,
panel kullanıcıları (parolalarıyla) taşındı, banka ve iki sınav yüklendi.

## Ürün tek cümlede

Almanca dil okulları için web tabanlı sınav platformu: öğrencinin seviyesini A1-C2
arasında sıfırdan belirler (seviye tespiti) ya da beyan ettiği seviyeyi taşıyıp
taşımadığını ölçer (seviye doğrulama). Dilbilgisi, okuma, dinleme, yazma ve konuşma
(kayıtlı video) bölümleri; güçlü tarayıcı gözetimi; yazma ve konuşmada AI önerir,
öğretmen karar verir. Kurs önerisi yapmaz.

Eski işe alım ürünü kaldırıldı; son hali `610da60` commit'inde.

Belgeler: `docs/design/EXAM-UX.md` (ekranlar, Sally + airbnb-ux), `docs/EXAM-ENGINE.md`
(ölçme modeli ve doğruluğu), `docs/PROCTORING.md` (ne görülür, ne görülmez, uyum).
`docs/PLAN.md` eski ürünü anlatır, tarihçe olarak durur.

## Çalıştırma

```bash
docker compose up -d        # Postgres 5434
pnpm db:migrate             # sürümlü göçler (drizzle/migrations) + drizzle/sql
pnpm db:reset               # SADECE yerel DB (5434 değilse reddeder): şemayı sıfırlar, göçleri baştan uygular
pnpm db:seed                # banka + sınavlar + 3 öğrenci; dinleme sesleri önbellekten
pnpm dev --port 3100
```

- Şema değişikliği: `src/db/schema` düzenle, `pnpm db:generate --name <ad>`, üretilen SQL'i gözden geçir (veri taşıyan adım elle yazılır), `pnpm db:fingerprint` ile boş bir push veritabanına karşı karşılaştır. `drizzle-kit push` kalıcı bir veritabanında artık kullanılmaz.
- Push ile kurulmuş eski bir veritabanı: önce `pg_dump`, sonra bir kez `pnpm db:migrate --adopt-baseline`.
- Platform yapısı: çekirdek + çözümler. Çözümler `src/solutions/<ad>/`, kayıt `src/solutions/registry.ts` (istemci) ve `registry.server.ts` (sunucu). Çekirdek kodun çözüm klasörüne doğrudan import'u ESLint ile yasak.
- Panel: sınav sayfaları `/exam/students`, `/exam/exams`, `/exam/bank` (eski adresler 307 ile yönlenir). Yan menü HIRING-UX 4.1.
- Aday API: sınava özel uçlar `/api/c/[token]/exam/*`; eski yollar bir sürüm boyunca rewrite ile çalışır (`src/lib/legacy-routes.ts`, sonra silinecek).
- Rol adı: `TEACHER` artık `MANAGER` ("Yönetici").
- Ortak yerel `kademe` veritabanı hâlâ eski şemada (rolü hâlâ `TEACHER`). Bu dalı ona karşı çalıştırmak için orada da bir kez `pnpm db:migrate --adopt-baseline` gerekir; başka oturumlar da bu veritabanını kullandığı için karar kullanıcıda. Bu dalın doğrulamaları ayrı `kademe_platform` veritabanında yapıldı.

- Panel: `kadiraycareer@gmail.com` / `kademe-dev-2026` (öğretmen: `ogretmen@kademe.local`, aynı parola)
- Yeni öğrenci linki: `pnpm dev:link` (seviye tespiti), `pnpm dev:link --claimed B1` (doğrulama)
- Sahte kamera/ekran yalnızca otomasyon testi için: `.env`'e YAZMAYIN; yalnızca dev sunucusunun kabuğunda `PROCTOR_DEV_FAKE=1 pnpm dev --port 3100` ile başlatın, iş bitince bayraksız yeniden başlatın. **Varsayılan kapalı.** Açıkken öğrenci sayfalarının üstünde kırmızı "DEV" şeridi çıkar; gerçek cihaz testinden önce kapatın. Üretimde hiç çalışmaz.
- Cron uçları (CRON_SECRET ile): `/api/cron/close-expired`, `/transcribe`, `/grade`,
  `/proctor-review`, `/purge-retention`
- Dinleme sesi eksikse: `pnpm bank:tts`

## Doğrulananlar (komut çıktısıyla)

| Ne | Kanıt |
|---|---|
| Tip, lint, test, build | `tsc` temiz, `eslint src scripts` temiz, `pnpm test` 467/467, `pnpm build` 51 rota |
| Uçtan uca sınav motoru | `pnpm verify:exam` tüm kontroller geçti: iki tam sınav, 95 durumda sızıntı taraması, sabit süre, yeniden yüklemede aynı soru, yanlış bölüm reddi, süre sonrası yazma reddi, dinleme hakkı sınırı, tek deneme |
| Uyarlanabilir doğruluk | simülasyon, `docs/EXAM-ENGINE.md` tablosu |
| Gerçek AI puanlama | `pnpm verify:grading`: Gemini `gemini-3.6-flash`, 10-13 sn, tüm kanıt alıntıları cevapta bulundu, telaffuz değerlendirilemez işaretli, ai_runs yazıldı |
| Gerçek AI gözetim ikinci bakışı | `pnpm verify:proctor`: 2 kare Gemini'ye gitti, 5 sn, "iki kişi" iddiasını düz karelerde doğrulamadı (UNCLEAR) |
| Dinleme sesleri | 18 kayıt Gemini TTS ile üretildi (49-110 sn), tarayıcıda gerçekten çaldı |
| Öğrenci akışı, Chrome'da (sahte medya) | onay, sistem kontrolü (7 satır sırayla), yeniden yükleme kapısı, uyarlanabilir dilbilgisi (doğru cevap sonrası B2 soru), okuma düzeni, dinleme, yazma (autosave, umlaut şeridi), konuşma kaydı + parçalı yükleme, bitiş ekranı, izlerin kapanması |
| Gözetim verisi, Chrome'dan | yapıştırma ve sağ tık engellendi, "birden fazla kişi" şeridi, olaylar ve kareler (başlangıç, periyodik, ihlal) veritabanına düştü, AI incelemesi kuyruğa girdi |
| MediaPipe modelleri | kendi sunucumuzdan yüklendi (`public/proctor/1.0.1`, sha256 sabit) |
| Öğretmen paneli, Chrome'da | Bugün kuyruğu, sonuç ekranı, AI önerisini onaylama, gerekçeyle değiştirme, kesinleştirme, bütünlük sekmesi ve işaret onaylama |
| Panel rotaları | 15 rota × TR/EN, hepsi 200 |
| Çekirdek ayrımı (yerel) | `tsc` temiz, `eslint src scripts` temiz, `pnpm test` 631/631, `pnpm build` 52 rota (`/_not-found` dahil); `pnpm verify:exam` ve `pnpm verify:guard` tüm kontroller geçti (`kademe_platform` veritabanında) |
| Göç provası (yerel 5434) | `kademe` yedeği geri yüklendi, `--adopt-baseline` ile 0001-0003 uygulandı, `verify:migration check` tüm satırlar ok (`dualWriteDrift` atlandı: 0001-0003 tek `db:migrate` içinde çalıştığı için eski kolonlar kontrolden önce silinmişti); yedek ikinci kez geri yüklenip aynı sayımlar alındı |
| Çekirdek ayrımı, Chrome'da (yerel, 2026-10-04) | Panel: `/students` 307 ile `/exam/students`'a gitti, sonuç ekranının özet, yazma, konuşma ve bütünlük sekmeleri açıldı, AI önerisi onaylandı (sayfa `/exam/students/<id>?tab=...` üstünde kaldı), davet linki bir kez gösterildi, `/exam/exams`, `/exam/exams/new`, `/exam/bank` ve bir soru açıldı, `/dashboard` açıldı, ayarlarda roller Sahip / Yönetici / Değerlendirici (EN: Owner / Manager / Reviewer). Aday (sahte medya, kırmızı DEV şeridi görünür): onay (davette ad ve e-posta olduğu için bilgi adımı atlandı), sistem kontrolü (7 satır; bu makinede ikinci monitör bağlı olduğundan tek ekran satırı sayfa içinden elle geçildi), dilbilgisi girişi, iki cevap, yeniden yüklemede aynı soru, bölümü erken bitirme, okuma girişi; istekler `/api/c/<token>/exam/answer`, `/exam/answer/commit`, `/exam/section/start`, `/exam/section/submit` yollarına, gözetim ve kalp atışı çekirdek yollara gitti, hiç 404 yok. Sahte medya kapatılınca DEV şeridi kalktı |

## Canlıda gerçek cihazla doğrulandı (2026-09-30, kullanıcının Chrome'u, macOS)

Test öğrencisi "Test Öğrenci (Kadir)" ile uçtan uca, veritabanından kontrol edildi:
gerçek kamera ve mikrofon (önizlemede yüz), MediaPipe gerçek yüzde (yüz sayısı 1),
oda sessizliği kalibrasyonu, tüm ekran paylaşımı, tam ekran, başlangıç ve periyodik
kareler, sekme/pencere değişimi olayları ve ihlal ekran kareleri, Gemini ikinci bakışı
(ekranda sınav yerine terminal görünen anı CONFIRMED, temiz kareleri NOT_CONFIRMED
dedi), uyarlanabilir dilbilgisi (10 soruda SE hedefine ulaştı), gerçek konuşma kaydı
(video/mp4) → ElevenLabs Scribe (Almanca) → Gemini puanlama önerisi, yazma puanlaması.
Zamanlayıcılar 1-2 dakikada bir çalıştığı için transkripsiyon ve puanlama bu kadar gecikir.

## Hâlâ doğrulanmadı

1. Telefonun kamerada gerçekten algılanması ve bakış işareti (canlı testte oluşmadı).
2. Ses algılama eşiği: canlı testte 4 "konuşma sesi" işareti oluştu; gerçek mi yanlış
   alarm mı bilinmiyor, öğretmen karelere bakıp karar verir.
3. Çift monitör, Firefox / Safari, telefonda engel ekranı.
4. Dinleme seslerinin telaffuz kalitesi (dinlenmedi).
5. Çekirdek ayrımı canlıda uygulanmadı. Canlı göç ayrı onay ister: canlı yedeğin yerel kopyasında (5434) prova, sonra servis durdur, `pg_dump`, `pnpm db:migrate --adopt-baseline`, deploy.
6. Çekirdek ayrımından sonra gerçek cihazla (sahte medya kapalı) uçtan uca sınav.
7. İşe alım çözümünün aday akışı ve paneli yok; bu plan yalnızca çekirdek ile sınav çözümünü ayırdı (işe alım alt proje 3).
8. Chrome turunda `/dashboard` üstünde 48 saat içinde dolacak link yoktu, bu yüzden link uzatma ve geri alma şeridi bu turda denenmedi.

## Canlıya çıkış (yapılmadı, ayrı onay)

Eski kod ile yeni kod 0001-0003 göçleri boyunca birbiriyle uyumsuz: eski kod yeni şemada, yeni kod eski şemada çalışmaz. Bu yüzden göç sırasında uygulama durdurulur.

Komutlar VM'de `/srv/kademe` içinde çalışır. `DATABASE_URL` VM'in ortam dosyasından gelir (`/etc/kademe/kademe.env`, yalnızca root okur); bu yüzden root kabuğunda (`sudo -i`) önce yüklenir:

```bash
set -a; . /etc/kademe/kademe.env; set +a
```

Adımlar sırayla:

1. Servisi ve bütün zamanlayıcıları durdur:
   ```bash
   sudo systemctl stop kademe.service
   sudo systemctl stop 'kademe-*.timer'
   ```
2. Canlı veritabanının yedeğini al. `pg_dump` bütün tabloları okuyabilen bir veritabanı kullanıcısıyla çalışmalı (okuyamadığı tablo olursa yedek eksik kalır ya da hata verir):
   ```bash
   pg_dump -Fc "$DATABASE_URL" -f kademe-$(date +%Y%m%d-%H%M).dump
   ```
3. Göç öncesi sayımları KAYNAK (canlı) veritabanında yakala:
   ```bash
   pnpm verify:migration capture /tmp/kademe-prod-before.json
   ```
4. Benimsemeden önce şemanın temel şemayla aynı olduğunu kontrol et: canlının parmak izini temel şemanın parmak iziyle karşılaştır. Depoda hazır bir temel parmak izi dosyası yok; boş bir yerel veritabanına yalnızca `drizzle/migrations/0000_baseline.sql` uygulanarak üretilir. Fark varsa durulur.
   ```bash
   pnpm db:fingerprint > /tmp/prod.fp
   DATABASE_URL=<boş yerel db, yalnızca 0000_baseline.sql> pnpm db:fingerprint > /tmp/baseline.fp
   diff /tmp/baseline.fp /tmp/prod.fp
   ```
5. Göç oturumuna kilit bekleme sınırı koy ve benimseyerek göç et. Sınır bağlantı adresine parametre olarak eklenir; `PGOPTIONS` kullanılmaz, çünkü `db:migrate` postgres.js ile bağlanır ve postgres.js `PGOPTIONS`'ı okumaz (yerelde `show lock_timeout` 0 verdi, adres parametresiyle 10s). Adreste zaten `?` varsa `&` ile eklenir. Bekleyen bütün göçler tek işlemde (transaction) çalışır; benimseme satırı ondan önce ayrı yazılır, bu yüzden göç yarıda kalırsa yeniden çalıştırma bayraksız (`pnpm db:migrate`) kaldığı yerden devam eder:
   ```bash
   case "$DATABASE_URL" in *\?*) SEP='&' ;; *) SEP='?' ;; esac
   DATABASE_URL="${DATABASE_URL}${SEP}lock_timeout=10s" pnpm db:migrate --adopt-baseline
   ```
6. Taşınan veriyi doğrula (bütün satırlar `ok` olmalı). 0001-0003 tek `db:migrate` içinde çalıştığı için `dualWriteDrift` satırı "skipped" çıkar; bu beklenir, eski kolonlar artık yoktur:
   ```bash
   pnpm verify:migration check /tmp/kademe-prod-before.json
   ```
7. Yeni kodu deploy et.
8. Servisi ve zamanlayıcıları başlat:
   ```bash
   sudo systemctl start kademe.service
   sudo systemctl start 'kademe-*.timer'
   ```

## Değişmezler

- Anahtar, rubrik, zorluk, dinleme metni ve soru id'leri öğrenciye asla gitmez:
  sorular yalnızca `toCandidateItem` ile, her gövde `candidateJson` ile çıkar.
- Süre sunucudadır; bölüm süresi başlarken bir kez yazılır.
- Sıradaki soruyu sunucu seçer, satır kilidi altında; yenileme aynı soruyu verir.
- AI asla nihai seviye yazmaz; öğretmen onaylar ya da gerekçeyle değiştirir.
- Davet anında sınav ayarı kopyalanır; sonradan değişen sınav öğrencinin sınavını değiştirmez.
- Davet başına tek deneme; tekrar sınav = yeni davet.
- Gözetim işaretleri kimseyi otomatik başarısız saymaz; sonlandırma yalnızca okul açarsa.

## Kararlar ve sapmalar

- **TTS: Gemini** (`gemini-3.8-flash-tts`, yedekler: flash-lite-tts, 3.1 preview, 2.5).
  ElevenLabs hesabı ücretsiz katmanda (10.000 karakter/ay), banka ~18.000 istiyor.
  Ücretsiz Gemini TTS kotası da küçük: ilk seed'de 9 kayıttan sonra 429; yedek modelle
  tamamlandı. Sesler içerik adresli önbellekte (`.storage/bank/audio`), yeniden seed ücretsiz.
- **Eski `src/lib/candidate-flow.ts` silindi** (git'te duruyor). Okunması otomatik izin
  sınıflandırıcısı tarafından engellendi; yerine `src/lib/exam-flow.ts` sıfırdan yazıldı.
- Ekran kaydı sürekli değil; kare tabanlı. İhlal klipleri, YAMNet ses teyidi yazılmadı.
- Kanıt karelerinin saklama işine (`purge-retention`) bağlanması yapılmadı.
- Reşit olmayanlar için veli onayı yok.
- E-posta gönderimi yok (davet linki panelde bir kez gösterilir, `message_outbox`'a yazılır).
- **Göç stratejisi:** expand (0001) / rol adı (0002) / contract (0003). Arada kod iki yere birden yazdı, sonra okuyucular taşındı; 0003'ten sonra `tsc` eski kolona okuyan kod kalmadığını kanıtladı.
- `proctorPolicy` sınavda kapalı (OFF) politikayı da döndürür; `null` yalnızca gözetimi olmayan çözüm içindir. Davranışı bire bir korumak için.
- `close-expired` kurtarma işi bölüm saatini `media_assets.section_run_id` üstünden okumaya devam eder (sınavın kendi bağı).
- Aday sayfaları (`/a/[token]`, `/info`, `/check`, `/done`) bu adımda sınava bağlı kaldı; işe alım için çözüme göre dağıtım alt proje 3'te.
- Canlı kurulum (2026-09-30): `scripts/setup-production.ts --confirm-host=<db host>` ile
  şema değişti (kullanıcılar korundu), dinleme sesleri VM'e kopyalandı (TTS çağrısı
  yapılmadı), `APP_ORIGIN` eklendi, yeni timer'lar `kademe-grade` (1 dk) ve
  `kademe-proctor-review` (2 dk). Depolama hâlâ VM diskinde (R2 kararı açık).

## Bağımsız kod incelemesi (2026-09-30 gece)

Bir alt ajan kodu düşmanca inceledi (dosya değiştirmeden): doğrudan anahtar/transkript
sızıntısı bulamadı, 14 kusur buldu. Düzeltilenler:

- Son bölüm kapanırken yarış: sonuç artık bütün bölümlerin kanıtı yazılmadan otomatik
  kesinleşmez; sonlandırılmış, eksik, yetersiz kanıtlı denemeler de kesinleşmez.
- Uyarlanabilir bölümü hemen bitirmek artık kazandırmaz: `minItems`e kadar eksik sorular
  yanlış sayılır (`verify:exam` kontrolü: hemen bırakan A1'e düşüyor).
- Sunucu artık onay, kişisel bilgi ve sistem kontrolü olmadan bölüm başlatmıyor (`NOT_READY`).
- Geç biten konuşma kaydı puanlamayı yeniden açıyor; sınav bittikten sonra yükleme tamamlanabiliyor.
- Deneme hakkı sayımı yüklenmekte olanı da sayıyor; tamamlama iki kez çalışmıyor.
- Sınav sürerken kesinleştirme ve kesinleşmiş sonuçta not değiştirme sunucuda reddediliyor.
- "Geçersiz" bütünlük kararı yayını engelliyor; otomatik yayın sadece temiz denemede.
- Gönderilmiş cevabın üstüne geç autosave yazılamıyor; çift tık iki kez puanlamıyor.
- Seçenek id'leri öğrenci başına rastgele takma adla gidiyor (konum ipucu yok).
- Kanıt yüklemede boyut okumadan önce kontrol ediliyor; gözetim kapalıyken reddediliyor.
- Bankadan silinen sorular yüzünden boş kalan bölüm öğrenciyi kilitlemiyor, atlanıyor.

Açık kalanlar: sınava başlamış öğrencinin bölümler arasında sınırsız bekleyebilmesi
(genel süre sınırı yok), dinleme ses URL'sinin 2 dakika tekrar kullanılabilmesi,
paralel `media/init` isteklerinde küçük bir yarış penceresi, öğrencinin konuşma yerine
yazmayı kendisinin seçebilmesi (öğretmene açıkça işaretli).

## Bilinen küçük pürüzler

- Otomasyon eklentisinin yazması giriş formuna ulaşmadı (JS ile girildi); gerçek
  klavyede sorun beklenmiyor ama denenmedi.
- Turbopack dev sunucusu çok sayıda dosya değişikliğinden sonra HMR paniği verdi;
  yeniden başlatmak yetti.
