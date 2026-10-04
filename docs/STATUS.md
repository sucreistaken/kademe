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
| Son inceleme düzeltmeleri (yerel, 2026-10-04) | Sınav paneli eylemleri (`exam/students/[id]/actions.ts`) artık her sorguda `assessments.solution = LANGUAGE_EXAM` ister; aynı kurumdaki bir HIRING davetinde hiçbir şey yazmadıklarını 7 eylem için birim testi gösterir. `/a/<token>/rights` kayıtlı modülü olmayan bir çözümün davetini bilinmeyen token gibi gösterir (birim testi + `verify:guard`: açık ve süresi dolmuş HIRING linki, bilinmeyen tokenla aynı durum kodu ve aynı görünen metin, ad yok; sınav linkinde form duruyor). `tsc` temiz, `eslint src scripts` temiz, `pnpm test` 649/649, `pnpm build` 52 rota, `pnpm verify:exam` ve `pnpm verify:guard` (31 kontrol) tüm kontroller geçti (`kademe_platform`) |
| Geri dönüş provası (yerel 5434, 2026-10-04) | `kademe`'nin yeni yedeği (`pg_dump` 17.11, 269177 bayt) geçici `kademe_rehearsal`'a yüklendi; `capture`, `lock_timeout=10s` ile `db:migrate --adopt-baseline`, `verify:migration check` 12 satır ok. Yalnız `pg_restore --clean --if-exists` ile geri dönüş BAŞARISIZ: 23 hata, ikinci `capture` eksik kolon hatasıyla durdu, şema yarı göçmüş, `drizzle.__drizzle_migrations` 4 satırla kaldı. Düzeltilmiş yol (önce `drizzle`, `pgboss`, `public` şemalarını düşür, `public`'i yarat, sonra `pg_restore --clean --if-exists --no-owner --exit-on-error`) temiz bir göçten sonra çıkış 0 verdi; ikinci `capture` ilkinin aynısı (`diff` boş), şema parmak izi göç öncesiyle aynı (536 satır), tam SQL dökümü satır sıralanınca aynı (yalnız `item_responses` içinde 8 satırın sırası farklı), göç günlüğü ve `exam_assessments` yok, bayraksız `pnpm db:migrate` "Refusing" ile 2 döndü. Aynı göçmüş kopyada `verify-retention.ts` kuru çalıştı ve hiçbir şeyi değiştirmedi, ama kesinleşmiş sonuca bağlı medya yoktu (birleşim denenmedi). Yalnız temel göç + `drizzle/sql` uygulanmış boş veritabanının parmak izi push ile kurulmuş kopyanınkiyle aynı. `kademe_rehearsal` sonunda silindi |

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
5. Çekirdek ayrımı canlıda uygulanmadı. Canlı göç ayrı onay ister: önce canlı yedeğin yerel kopyasında (5434) prova, sonra pencerede sırayla devam eden sınav kontrolü, servis ve zamanlayıcıları durdur, `pg_dump`, yeni kodu çek ve kur, sayım yakala, parmak izi karşılaştır, `pnpm db:migrate --adopt-baseline`, `verify:migration check`, build, başlat. Ayrıntı ve geri dönüş: "Canlıya çıkış" bölümü.
6. Çekirdek ayrımından sonra gerçek cihazla (sahte medya kapalı) uçtan uca sınav.
7. İşe alım çözümünün aday akışı ve paneli yok; bu plan yalnızca çekirdek ile sınav çözümünü ayırdı (işe alım alt proje 3).
8. Chrome turunda `/dashboard` üstünde 48 saat içinde dolacak link yoktu, bu yüzden link uzatma ve geri alma şeridi bu turda denenmedi.
9. Canlıya çıkış ve geri dönüş adımları VM'de ve Neon'da hiç çalıştırılmadı. Doğrulanmayanlar: canlı `DATABASE_URL`'in pooler olup olmadığı ve pooler'ın `lock_timeout` parametresini gerçekten reddedip reddetmediği, VM'deki `pg_dump`/`pg_restore`/`psql` sürümleri (ve kurulu olup olmadıkları), Neon'un sunucu sürümü ve parmak izinde yazım farkı çıkıp çıkmayacağı, Neon'da `public` şemasını düşürüp yeniden yaratma yetkisi, canlıdaki şema listesi, `systemctl stop 'kademe-*.service'` kalıbının VM'deki birimlerle eşleşmesi.
10. Saklamanın `attempt_id` birleşimi, kesinleşmiş sonuca bağlı medya üstünde hiç çalışmadı (yerel veride böyle medya yok); canlı kopyada `verify-retention.ts` ile denenecek.

## Canlıya çıkış (yapılmadı, ayrı onay)

Eski kod ile yeni kod 0001-0003 göçleri boyunca birbiriyle uyumsuz: eski kod yeni şemada, yeni kod eski şemada çalışmaz. Bu yüzden göç sırasında uygulama durdurulur.

Canlıdaki kod `3f2b8a8` (inceleme notuna göre; VM'de `git rev-parse HEAD` ile adım 4'te teyit edilir). O commit'te ne `pnpm verify:migration` ne `pnpm db:migrate` vardır (`git show 3f2b8a8:package.json` ile bakıldı: yalnızca `db:push`, `db:setup`, `db:sql`). Bu yüzden sayım ve göç komutları ancak yeni kod çekilip kurulduktan SONRA çalışır.

**Bu bölümdeki VM ve Neon adımlarının hiçbiri VM'de ya da Neon'da çalıştırılmadı.** Yerelde (5434, PostgreSQL 17.11) prova edilenler "Doğrulananlar" tablosundadır; VM'deki araç sürümleri, Neon'un pooler davranışı ve Neon'da şema düşürme yetkisi doğrulanmadı.

### Pencereden önce (yerelde, ayrı onayla)

- [ ] Sürüm `main`'e birleşmiş ve itilmiş olmalı; VM `origin main`'den çeker.
- [ ] Canlı yedeğin yerel kopyasında (5434, geçici veritabanı) tam prova: aşağıdaki 8-11. adımlar ve "Geri dönüş B", yerelde 2026-10-04'te yapılanın aynısı ("Doğrulananlar" tablosu).
- [ ] Aynı geri yüklenmiş canlı kopyada, göçten sonra saklama kuru çalıştırması: `DATABASE_URL=<canlı kopya> pnpm exec tsx scripts/verify-retention.ts` (salt okur, sonunda hiçbir şeyin değişmediğini kendisi kontrol eder; `pnpm verify:retention` diye bir komut yok). Sebep: saklamanın `media_assets.attempt_id` birleşimi, sonucu kesinleşmiş (`FINAL`) bir denemeye ait medya üstünde hiç çalışmadı. Yerel provada (2026-10-04) 1 medya satırı vardı ve hiçbiri kesinleşmiş bir sonuca bağlı değildi; betik bunu "none on the media clock. Expected, not a join failure" diye raporladı, yani birleşim gerçek veride hâlâ denenmedi. Canlı kopyada bu satır sıfırdan büyük çıkmalı ve betik "dry run was dry" demeli.
- [ ] Temel şemanın parmak izini yerelde üret (adım 8 bunu kullanır). Boş bir geçici veritabanına YALNIZCA temel göç ve `drizzle/sql` dosyaları psql ile uygulanır (`db:migrate` kullanılmaz, o 0001-0003'ü de uygular):
  ```bash
  psql "postgresql://kademe:kademe@localhost:5434/postgres" -c "create database kademe_baseline owner kademe"
  B=postgresql://kademe:kademe@localhost:5434/kademe_baseline
  psql "$B" -q -v ON_ERROR_STOP=1 -f drizzle/migrations/0000_baseline.sql
  for f in drizzle/sql/*.sql; do psql "$B" -q -v ON_ERROR_STOP=1 -f "$f"; done
  DATABASE_URL="$B" pnpm -s db:fingerprint > /tmp/baseline.fp
  psql "postgresql://kademe:kademe@localhost:5434/postgres" -c "drop database kademe_baseline"
  gcloud compute scp /tmp/baseline.fp kademe-app:/tmp/baseline.fp --zone europe-west3-a
  ```
  Yerelde 2026-10-04'te bu yolla üretilen parmak izi, push ile kurulmuş `kademe` kopyasınınkiyle satır satır aynı çıktı (536 satır, `diff` boş).

### Pencere

Komutlar VM'de root kabuğunda (`sudo -i`), `/srv/kademe` içinde çalışır. `DATABASE_URL` ortam dosyasından gelir (`/etc/kademe/kademe.env`, yalnızca root okur). Depo komutları, deploy tarifindeki gibi `kademe` kullanıcısıyla çalışır; `asK` bunun kısaltmasıdır:

```bash
cd /srv/kademe
set -a; . /etc/kademe/kademe.env; set +a
asK() { sudo -u kademe -E env HOME=/home/kademe "$@"; }
```

1. **Doğrudan (pooler olmayan) Neon adresi.** 2-11. adımlar ve geri dönüş bu adresi kullanır. Neon'un `-pooler` adresi (PgBouncer) `lock_timeout` gibi bir başlangıç parametresini reddedebilir ve `pg_dump` için güvenilir değildir. Uygulamanın kendisi ortam dosyasındaki adresle çalışmaya devam eder; dosya değiştirilmez. Canlı adresin pooler olup olmadığı bilinmiyor (doğrulanmadı):
   ```bash
   DIRECT_URL=$(printf '%s' "$DATABASE_URL" | sed 's/-pooler\././')
   printf '%s\n' "$DIRECT_URL" | sed -E 's#^[^@]*@([^/?]*).*#\1#'   # yalnızca host'u yazar; içinde -pooler OLMAMALI
   psql "$DIRECT_URL" -Atc 'select 1'
   ```
2. **İstemci ve sunucu sürümü.** `pg_dump` ve `pg_restore`'un ana sürümü sunucununkinden küçük olamaz; küçükse `pg_dump` yedek almadan durur (yerelde görüldü: `pg_dump` 16.15, sunucu 17.11, "sunucu sürümü uyuşmazlığı nedeniyle iptal ediliyor"). İkisini karşılaştır, uymuyorsa sunucunun ana sürümündeki istemciyi kur ve bu adımı tekrarla. VM'de hangi sürümün kurulu olduğu, hatta `psql`'in kurulu olup olmadığı doğrulanmadı:
   ```bash
   pg_dump --version; pg_restore --version
   psql "$DIRECT_URL" -Atc 'show server_version'
   ```
3. **Devam eden sınav var mı?** Durdurmadan hemen önce, başlamış ama teslim edilmemiş ve son 10 dakikada kalp atışı gelmiş bölümleri say. Satır dönerse durdurma: bölümlerin `deadline_at`'i geçene kadar bekle ya da pencereyi sınavsız bir saate al ve bu adımı tekrarla:
   ```bash
   psql "$DIRECT_URL" -c "select id, attempt_id, started_at, deadline_at, last_heartbeat_at from section_runs where started_at is not null and submitted_at is null and last_heartbeat_at > now() - interval '10 minutes' order by deadline_at"
   ```
4. **Geri dönülecek commit'i not et** (beklenen `3f2b8a8`, farklıysa geri dönüşte o kullanılır):
   ```bash
   OLD=$(sudo -u kademe git -C /srv/kademe rev-parse HEAD); echo "$OLD"
   ```
5. **Servisi ve zamanlayıcıları durdur**, o an çalışan zamanlayıcı işi varsa onu da bitir:
   ```bash
   systemctl stop kademe.service
   systemctl stop 'kademe-*.timer'
   systemctl stop 'kademe-*.service'
   systemctl list-units 'kademe*' --state=active   # boş olmalı
   ```
6. **Yedek.** `pg_dump` bütün tabloları okuyabilen bir veritabanı kullanıcısıyla, doğrudan adresle çalışır. Yedek depo klasörünün dışına yazılır; okunabildiği `pg_restore -l` ile kontrol edilir:
   ```bash
   mkdir -p /root/kademe-backups
   DUMP=/root/kademe-backups/kademe-$(date +%Y%m%d-%H%M).dump
   pg_dump -Fc "$DIRECT_URL" -f "$DUMP" && ls -l "$DUMP"
   pg_restore -l "$DUMP" | grep -c 'TABLE DATA'   # 0'dan büyük olmalı
   ```
7. **Yeni kodu çek ve kur** (deploy tarifinin 1-2. adımı; build henüz yok):
   ```bash
   sudo -u kademe git -C /srv/kademe pull --ff-only origin main
   asK pnpm install --frozen-lockfile
   ```
8. **Göç öncesi sayımları yakala** (veritabanı hâlâ eski şemada, betik yeni koddan gelir):
   ```bash
   asK DATABASE_URL="$DIRECT_URL" pnpm verify:migration capture /tmp/kademe-prod-before.json
   ```
9. **Parmak izi.** Canlının şeması temel şemayla aynı olmalı; `/tmp/baseline.fp` pencereden önce yerelde üretilip VM'e kopyalandı. Fark varsa göç yapılmaz, "Geri dönüş A" uygulanır. Neon'un sunucu sürümü yerel PG17'den farklıysa yalnızca yazım farkı çıkabilir (ör. bir `default` ifadesinin ya da bir kısıtın yazılışı); böyle bir satırın gerçekten aynı şema olup olmadığına bir insan karar verir, betik karar vermez:
   ```bash
   asK DATABASE_URL="$DIRECT_URL" pnpm -s db:fingerprint > /tmp/prod.fp
   diff /tmp/baseline.fp /tmp/prod.fp && echo SAME
   ```
10. **Göç.** Kilit bekleme sınırı bağlantı adresine parametre olarak eklenir; `PGOPTIONS` kullanılmaz, çünkü `db:migrate` postgres.js ile bağlanır ve postgres.js `PGOPTIONS`'ı okumaz (yerelde `show lock_timeout` 0 verdi, adres parametresiyle 10s). Adreste zaten `?` varsa `&` ile eklenir. Bekleyen bütün göçler tek işlemde (transaction) çalışır; benimseme satırı ondan önce ayrı yazılır, bu yüzden göç yarıda kalırsa yeniden çalıştırma bayraksız (`pnpm db:migrate`) kaldığı yerden devam eder:
    ```bash
    case "$DIRECT_URL" in *\?*) SEP='&' ;; *) SEP='?' ;; esac
    asK DATABASE_URL="${DIRECT_URL}${SEP}lock_timeout=10s" pnpm db:migrate --adopt-baseline
    ```
11. **Taşınan veriyi doğrula** (bütün satırlar `ok`). 0001-0003 tek `db:migrate` içinde çalıştığı için `dualWriteDrift` satırı "skipped" çıkar; bu beklenir. Bir satır `ok` değilse "Geri dönüş B":
    ```bash
    asK DATABASE_URL="$DIRECT_URL" pnpm verify:migration check /tmp/kademe-prod-before.json
    ```
12. **Build** (deploy tarifinin 3. adımı; build ortam dosyasını ve yazılabilir bir HOME ister). Başarısızsa "Geri dönüş B":
    ```bash
    asK NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2048 pnpm build
    ```
13. **Başlat ve dene:**
    ```bash
    systemctl start kademe.service
    systemctl start 'kademe-*.timer'
    curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login
    journalctl -u kademe -n 50 --no-pager
    ```

### Geri dönüş

**A. Göçten önce durulduysa** (1-9. adımlarda bir sorun, ör. sürüm uyuşmazlığı, devam eden sınav, parmak izi farkı): veritabanına dokunulmadı. Eski kodu geri al, kur, build et, başlat:

```bash
sudo -u kademe git -C /srv/kademe checkout --detach "$OLD"
asK pnpm install --frozen-lockfile
asK NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2048 pnpm build
systemctl start kademe.service; systemctl start 'kademe-*.timer'
```

**B. Göç işlendikten sonra** (`verify:migration check` başarısız, build başarısız ya da yeni kod canlıda yanlış davranıyor): 6. adımın yedeği aynı veritabanına geri yüklenir. Yeni kod bu arada çalıştıysa yedekten sonra yazılan her şey (yeni cevaplar, kayıtlar) kaybolur; bu yüzden karar hızlı verilir.

Yalnız `pg_restore --clean --if-exists` YETMEZ. Yerelde denendi (2026-10-04): göçün eklediği tablolar (`exam_assessments` vb.) eski tablolara yabancı anahtarla bağlı olduğu için eski tablolar düşürülemedi, `pg_restore` 23 hatayla çıktı, şema yarı göçmüş kaldı (`assessments.blueprint_id` yok, `exam_assessments` duruyor) ve `drizzle.__drizzle_migrations` 4 satırıyla yerinde kaldı. Bu günlük kalırsa sonraki `db:migrate` göçleri uygulanmış sanar. Bu yüzden önce şemalar düşürülür, sonra yedek yüklenir:

```bash
systemctl stop kademe.service; systemctl stop 'kademe-*.timer'; systemctl stop 'kademe-*.service'
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 \
  -c 'drop schema if exists drizzle cascade' \
  -c 'drop schema if exists pgboss cascade' \
  -c 'drop schema if exists public cascade' \
  -c 'create schema public'
pg_restore --clean --if-exists --no-owner --exit-on-error -d "$DIRECT_URL" "$DUMP"; echo "exit $?"   # 0 olmalı
# Yeni kod hâlâ yerindeyken: sayımlar göç öncesiyle aynı olmalı, göç günlüğü ve yeni tablo olmamalı
asK DATABASE_URL="$DIRECT_URL" pnpm verify:migration capture /tmp/kademe-prod-after-rollback.json
diff /tmp/kademe-prod-before.json /tmp/kademe-prod-after-rollback.json && echo SAME
psql "$DIRECT_URL" -Atc "select to_regclass('drizzle.__drizzle_migrations') is null, to_regclass('public.exam_assessments') is null"   # t|t
```

Sonra A'daki gibi `$OLD`'a dön, kur, build et, başlat. Notlar:

- `drop schema` listesi yerel yedeğin şemalarına göre yazıldı (`public`, `pgboss`; `drizzle` göçle gelir). Canlıda başka bir şema varsa (`pg_restore -l "$DUMP" | grep SCHEMA`) o da listeye eklenir. Canlıdaki şemalar ve Neon'da `public` şemasını düşürüp yeniden yaratma yetkisi doğrulanmadı.
- Canlı göçten önce zaten bir `drizzle` şeması varsa (beklenmez; push ile kuruldu) yedekte de vardır ve geri yükleme onu geri getirir; o zaman son kontroldeki ilk değer `f` olur ve bu normaldir.
- VM `$OLD`'da "detached" kalır. Bir sonraki deploy'dan önce `sudo -u kademe git -C /srv/kademe checkout main`.

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
