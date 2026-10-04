# Kademe - durum ve devir belgesi

Son güncelleme: 2026-10-04 (çekirdek ayrımı ve işe alım plan 1, kütüphane ve alımlar,
`platform/solutions` dalında, yerelde doğrulandı; canlıya çıkmadı). **Canlıda**: https://kademe.kadiray.com, commit `3f2b8a8`
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
- `pnpm db:seed-library`: kütüphane başlangıç içeriği (5 seviyeli skala, 8 yetkinlik TR+EN, 1/3/5 çapaları, gözlem etiketleri). Yalnızca yerel 5434, `kademe` paylaşımlı veritabanını reddeder; kütüphane boşsa aynı içerik `/library/competencies`'teki "Başlangıç içeriğini ekle" ile de yazılır.
- `pnpm verify:hiring-immutability` ve `pnpm verify:hiring-setup`: yalnızca adı `_check` ile biten geçici bir veritabanında, her biri ayrı ve temiz bir veritabanında:
  ```bash
  docker exec kademe-db psql -U kademe -d postgres -c "drop database if exists kademe_hiring_check" -c "create database kademe_hiring_check"
  DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm db:migrate
  DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_hiring_check pnpm verify:hiring-immutability   # ya da verify:hiring-setup
  docker exec kademe-db psql -U kademe -d postgres -c "drop database kademe_hiring_check"
  ```
- İşe alım paneli: `/hiring/openings` (Alımlar), bir alımın sekmeleri Genel bakış, Değerlendirme (Özet, Kurucu, AI taslağı, Puan kartı, Önizleme), Ekip ve kurallar. Kütüphane: `/library/positions`, `/library/competencies` (skalalar sekmesi dahil). Aday tarafı yok (plan 2).

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
| İşe alım plan 1 (yerel, kademe_platform, 2026-10-04) | `tsc` temiz, `eslint src scripts` temiz, `pnpm test` 1413/1413 (111 dosya), `pnpm build` 67 rota (`/_not-found` dahil; 15'i yeni `/hiring` ve `/library` rotası). `pnpm verify:exam` tüm kontroller geçti (24 `ok`) ve `pnpm verify:guard` 31 `ok` (`kademe_platform`, dev sunucusu 3100). Temiz `kademe_hiring_check` üstünde 0000-0009 göçleri, sonra `verify:hiring-immutability` 43 `ok`; ayrı temiz bir `kademe_hiring_check` üstünde `verify:hiring-setup` 180 `ok`; ikisinde de FAIL yok, veritabanı sonunda silindi. Em-dash taraması (`git diff --name-only 992962d HEAD`, 240 dosya): eşleşme yok. Chrome turu (`kademe_platform`'un geçici kopyası `kademe_ui_check`, sonunda silindi): pozisyon oluşturma, "Bu pozisyon için alım aç", AI taslağı (1 canlı istek), iki aşama kabulü, tek seçimli soru ve doğru cevap, AI soru kontrolü (1 canlı istek), çapa Sheet'i ve Escape, ağırlıklar 60/10/10/10/10, masaüstü ve mobil önizleme, Ekip ve kurallar, beş hazırlık satırı "Tamam", Yayınla, salt okunur kurucu, "Düzenlemeye başla" ile v2; TR ile yürüdü, sonra EN'e geçilip 12 sayfa tarandı (her sayfada tek dolu buton, em-dash yok) |
| Geri dönüş provası 0009'a kadar (yerel 5434, 2026-10-04, son düzeltme dalgası) | `kademe`'nin yeni `pg_dump` yedeği (17.11, salt okuma, 269177 bayt, 39 tablo verisi) geçici `kademe_rehearsal`'a yüklendi. `capture`: assessments 9, attempts 7, media 1, events 41, users 2, managers 1. Bayraksız `db:migrate` "Refusing" ile 2 döndü; `lock_timeout=10s` ile `db:migrate --adopt-baseline` 0001-0009 + `drizzle/sql`'i uyguladı (çıkış 0, göç günlüğü 10 satır, 4 işe alım tetikleyicisi, 15 kütüphane ve işe alım tablosu). `verify:migration check` 12 satırın hepsi ok (`dualWriteDrift` beklendiği gibi atlandı). Göçmüş kopyanın parmak izi temiz bir `drizzle-kit push` + `drizzle/sql` veritabanınınkiyle aynı (785 / 785 satır, `diff` boş, push günlüğünde hata yok). Geri dönüş "Geri dönüş B" ile: `drizzle`, `pgboss`, `public` düşürüldü, `public` yaratıldı, `pg_restore --clean --if-exists --no-owner --exit-on-error` çıkış 0. İkinci `capture` ilkinin aynısı (`diff` boş), parmak izi göç öncesiyle aynı (536 satır), satır sıralı tam veri dökümü aynı (690 INSERT satırı, `diff` boş), göç günlüğü, `exam_assessments`, `hiring_versions`, `competencies` yok, bayraksız `db:migrate` yine "Refusing" ile 2. `kademe_rehearsal` ve push veritabanı silindi; `kademe`'ye yazılmadı |
| Son düzeltme dalgası (yerel, 2026-10-04) | `tsc` temiz, `eslint src scripts` temiz, `pnpm test` 1453/1453 (117 dosya), `pnpm build` 67 rota. `pnpm verify:exam` tüm kontroller geçti (24 `ok`), `pnpm verify:guard` 31 `ok` (`kademe_platform`, dev sunucusu 3100). Ayrı temiz `kademe_hiring_check` veritabanlarında `verify:hiring-immutability` 43 `ok`, `verify:hiring-setup` 188 `ok`, ikisi de 0 FAIL; veritabanları silindi. Chrome turu atılabilir `kademe_ui_check` kopyasında (sunucu `TZ=Asia/Tokyo`, AI anahtarları boş, canlı AI çağrısı yok), sonra silindi: değerlendirici kütüphanede yalnız üyesi olduğu alımı adıyla görüyor, diğeri sayı olarak (sayfa ve RSC içinde adı ve id'si yok); önizleme bitiş ekranında canlı bölge boş, odak başlıkta; önizlemeden sonra bir taslak düzenlemesi hazırlık satırını "Önerilir"e döndürüyor; AI taslağında kabul edilmiş aşamanın "Geri al"ı geri alma şeridi gösteriyor, şeritteki "Geri al" kurucuda düzenlenmiş hâliyle geri getiriyor, başka yerde silinmiş aşamanın işareti kalkıyor; 40 sn sonra bekleme satırı "Hâlâ çalışıyor" diyor; Tokyo saatinde çalışan sunucuda son tarih "31 Oct"; Yayınla, Kapat, Yeniden aç, Düzenlemeye başla bekleme metni + disabled + aria-busy; yayın ve kapatma bildirimi adres çubuğundan kalkıyor, yenilemede tekrar görünmüyor; dev günlüğünde `ENVIRONMENT_FALLBACK` yok |
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
7. İşe alımın aday akışı yok (plan 2): HIRING davetleri bilinçli olarak bilinmeyen token gibi cevaplanıyor (`candidateFlowLive: false`). Davet, inceleme, karar, gözetim plan 2-4.
8. Chrome turunda `/dashboard` üstünde 48 saat içinde dolacak link yoktu, bu yüzden link uzatma ve geri alma şeridi bu turda denenmedi.
9. Canlıya çıkış ve geri dönüş adımları VM'de ve Neon'da hiç çalıştırılmadı. Doğrulanmayanlar: canlı `DATABASE_URL`'in pooler olup olmadığı ve pooler'ın `lock_timeout` parametresini gerçekten reddedip reddetmediği, VM'deki `pg_dump`/`pg_restore`/`psql` sürümleri (ve kurulu olup olmadıkları), Neon'un sunucu sürümü ve parmak izinde yazım farkı çıkıp çıkmayacağı, Neon'da `public` şemasını düşürüp yeniden yaratma yetkisi, canlıdaki şema listesi, `systemctl stop 'kademe-*.service'` kalıbının VM'deki birimlerle eşleşmesi.
10. Saklamanın `attempt_id` birleşimi, kesinleşmiş sonuca bağlı medya üstünde hiç çalışmadı (yerel veride böyle medya yok); canlı kopyada `verify-retention.ts` ile denenecek.
11. Canlı veritabanına 0004-0009 göçleri (kütüphane, alımlar, değişmezlik tetikleyicileri, şema korumaları) uygulanmadı; canlıya çıkış ayrı onay. Yerel prova 0009'a kadar ve geri dönüşüyle yapıldı ("Doğrulananlar"). Başlangıç kütüphanesi canlıya göçle ya da `pnpm db:seed-library` ile gitmez (o komut yalnız yereldir): kurum, kütüphane boşken `/library/competencies`'teki "Başlangıç içeriğini ekle" düğmesiyle ekler. Canlı veritabanı rolü işe alım tablolarının sahibi ya da süper kullanıcı olmamalı (tetikleyiciler uygulama hatasına karşı korur, yetkili kişiye karşı değil); sahip olmayan bir rol `hiring_versions` ve `competencies` üstünde UPDATE yetkisine ihtiyaç duyar (`FOR SHARE` bunu ister). VM'de ve Neon'da doğrulanmadı.
12. Canlı AI: üç amaç da canlı çağrıyla görüldü (ANCHOR_DRAFT Görev 7'de Gemini, HIRING_DRAFT Görev 17'de Gemini, QUESTION_CHECK Görev 18'de ve son Chrome turunda Gemini). Son turdaki HIRING_DRAFT isteğinde Gemini 503 verdi, istek NVIDIA yedeğine (`nvidia/nemotron-3-ultra-550b-a55b`) düştü ve 3,0 dakika sürdü (ekran artık 40 sn sonra "Hâlâ çalışıyor; sağlayıcı yavaş yanıt veriyor" diyor, istemci tarafında süre sınırı yok); 2 `ai_runs` satırı (biri hata kaydı). Yedek modelin taslak kalitesi ayrıca değerlendirilmedi.
13. Chrome turunda görülmeyenler: AI'nın yeni yetkinlik kartını kabul etmek (bu turda görünür bir yetkinlik kartı gelmedi, 1 öneri ilanda dayanağı olmadığı için gizlendi), eksik çapa yüzünden kapalı "Yayınla" (başlangıç yetkinliklerinin çapaları tam; kapı `verify:hiring-setup` ile doğrulandı), Değerlendirici rolüyle erişim, alımı kapatma ve yeniden açma, yeni yetkinlik ve skala düzenleme, hata durumları. HIRING-UX 2.1'den bu turda görülenler: R2 kısmen (hazırlık satırı, Sheet'te 1/3/5), R12 kısmen (AI ekranı metni, yalnızca HIRING_DRAFT ve QUESTION_CHECK satırları), E1 (12 sayfada tek dolu buton, kapalı butonlar nedenini yanında söylüyor), E2 kısmen (boş pozisyon listesi, AI "Hazırlanıyor"), E3 (TR ve EN; anahtar eşitliği testte), E4 göz kontrolü, E5 (sayfa metinleri ve dosya taraması). 2.1'in geri kalanı doğrulanmadı.
14. Elle klavye kontrolleri: "Soru ekle" menüsünde ok ve harfle gezinme denenmedi; çapa Sheet'inde Escape otomasyonla denendi (kapandı, odak "Düzenle"ye döndü), Radix seçimde ok tuşu otomasyonla denendi (Ekip ve kurallar'da ilk denemede seçim değişmedi, nedeni bilinmiyor; ikinci denemede vurgu 2'den 1'e geçti ve Enter seçti), gerçek klavyeyle değil. Otomasyon Chrome penceresini yeniden boyutlandıramadığı için dar genişlikler önceki görevlerde iframe içinde kontrol edildi; gerçek dar pencere doğrulanmadı. 1280 genişlikte kurucunun panelleri alt alta diziliyor (editör 712 px, eşik ~740 px).
15. Son düzeltme dalgası yapıldı (aşağıdaki "Son düzeltme dalgası"). Bilerek sonraki planlara bırakılanlar: registry testinin menü etiketlerini TR/EN tekrar doğrulaması; yayın kapısının ulaşılamaz `NOT_WHOLE` kodu; puan kartında daha kısa ekran okuyucu sütun adları; yeni sürüm anahtarına eski AI oturumunun yazılması (kendini düzeltir); önizleme ilerleme çubuğu ile aşama metninin tanımı (plan 2); her otomatik kayıtta tüm kurucunun yeniden doğrulanması (plan 2 ölçeğinde ölçülecek); ağırlık setlerinin tetikleyiciyle dondurulmaması (plan 3).
16. next-intl `ENVIRONMENT_FALLBACK` uyarısı giderildi (yönetici ve aday sağlayıcıları `ORG_TIMEZONE`'u sunucudan alıyor; dev günlüğünde uyarı yok). İstemci bileşeninde biçimlenen tarih (`LinkProblem`) varsayılan bölgeyi kullanır; `ORG_TIMEZONE` varsayılandan farklı ayarlanırsa orada sunucu ile tarayıcı farklı gün yazabilir, doğrulanmadı.
17. Kullanıcıya sorulacak tasarım noktası: kurucudaki koyu "Sadece ekip görür" paneli HIRING-UX 5.5'e göre; daha açık isteniyorsa karar kullanıcıda.

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

## Son düzeltme dalgası (2026-10-04, son inceleme sonrası)

- Puan kartı anlık görüntüsü: etiketler kütüphanedeki sırayla (`order_index`, sonra id), `schemaVersion: 1`, her yetkinliğin açıklaması. Henüz yayında satır yoktu, değişiklik ekleyici.
- Kütüphanenin "Nerede kullanılıyor" bloğu bakanı alıyor: alımlar `openingAccess` ile süzülür; görme hakkı olmayan alım sayılır, adı ve linki gösterilmez.
- `candidateSafe` işe alımın ekip alanlarını (iç soru, beklenen davranışlar, kırmızı bayraklar, yönetici notu, örnek cevaplar, iç amaç, yetkinlik id'leri, puan kartı, ağırlıklar, çapalar) da siler.
- Taslağa her yazma `hiring_versions.updated_at`'i aynı işlemin son adımında ilerletir; "Önizleme" hazırlık satırı yalnız `previewed_at >= updated_at` iken tamam.
- AI taslağı: kabul edilmiş aşamanın "Geri al"ı kurucununkiyle aynı imzalı geri alma bileti döndürür ve şerit gösterir; `NOT_FOUND`'da kabul işareti kalkar; 40 sn sonra dürüst bekleme metni.
- Tek `PendingButton` (`components/ui`) beş kopyanın yerine; tek URL bildirimi yardımcısı (`lib/url-notice`, `components/ui/url-notice`).
- Tarihler ve ağırlık seti etiketi kurum saat diliminde; `openingAccess` ve `canDecide` `opening:write` yetkisinden türer; arşivli pozisyona ilan yazılmaz; "plan to have" yalnız aile ifadelerinde; bitiş ekranı iki kez okunmaz; EN "Your role cannot open a hiring opening."
- `verify:hiring-setup` v1 çapa kontrolü artık `saveCompetency` ile kütüphaneyi değiştirip v2'nin yeni, v1'in eski metni taşıdığını doğruluyor; `tenancy.test.ts` ortak `test-fake-db.ts`'i kullanıyor.

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

**İşe alım plan 1 (kütüphane ve alımlar, 2026-10-04).** Plan: `docs/superpowers/plans/2026-10-04-hiring-library-openings.md`; tüm hükümler `.superpowers/sdd/2026-10-04-hiring-library-openings/progress.md`'de.

- (1) İşe alım adaylara manifest bayrağıyla görünmez: `candidateFlowLive: false`; plan 2 tek bir değeri çevirir.
- (2) `inviteHref` artık `string | null`; Bugün'ün davet düğmesi davet edebilen ilk çözümü kullanır (`inviteTargets()`), işe alım `null`.
- (3) Kütüphanenin "nerede kullanılıyor" bilgisi sözleşme kancasıyla gelir (`library.usage`); "Bu pozisyon için alım aç" manifestteki `positionAction`'dan.
- (4) Yetkinliklere spec'te olmayan `seed_key` ve `reviewed_at` eklendi ("ekibiniz incelemedi" etiketi); pozisyonlara ekip, beceriler, diller.
- (5) Kurum başına tek skala; "Skala ekle" yapılmadı.
- (6) Taslak ağırlıklar taslak sürümde, yayındaki ağırlıklar `hiring_weight_sets`'te (sonrakiler gerekçeli); profil ağırlığı önem derecesi, en büyük kalan ile 100'e tam sayıya çevrilir. Ağırlık kapalıyken yayında kaydedilen set, uygulanan etkin yüzdeleri tutar.
- (7) Yayın kapısı = spec 2.2 kuralları + aşama adı ve sorusu, soru metni, arşivli yetkinlik; ayrıca seçenek, yetkinlik sayısı ve ağırlık kodları. Hazırlıkta yapı, çapalar, ağırlıklar ayrı satırlar; "Ekibi ata" (aktif karar veren ister) ve "Önizle" öneri niteliğinde, yayını engellemez. Hiç yetkinlik ölçmeyen sürüm yayınlanmaz (`NO_MEASURED_COMPETENCY`); ağırlık açıkken ağırlığı olmayan ölçülen yetkinlik `WEIGHTS_MISSING`.
- (8) Yayındaki sürümü düzenlemek açıktır: kurucu salt okunur, "Düzenlemeye başla" v(n+1) kopyasını açar. AI ekranı da yayında taslak açmaz (`NO_DRAFT`, C5).
- (9) Sıra "Yukarı taşı / Aşağı taşı" ile, sürükle bırak yok; soru başına en fazla 2 yetkinlik veritabanı kuralı; aşama başına en fazla 20 soru (`STAGE_FULL`).
- (10) AI önerileri veritabanında tutulmaz (sekme oturumunda saklanır, yeniden üretmek yeni `ai_runs` satırı); kart yalnızca ilanda bulunan alıntıyla gösterilir; kabul geri alınabilir. Ekip metinleri (1/3/5 örnekleri) arayüz dilinde değil sürümün dilinde üretilir.
- (11) Soru kontrolü = kural + AI. Kural katmanı 6701 s.K. md. 3 ve İş K. md. 5'teki korunan alanları TR/EN, ASCII yazımıyla birlikte arar; askerlik bilerek işaretlenmez (işin gereği olarak sorulabilir).
- (12) Gözetim seviyesi bu planda düzenlenmez (plan 4); `consent_text_id` boş kalır (plan 2).
- (13) Erişim: Sahip ve Yönetici her alımı görür ve düzenler; Değerlendirici yalnızca üye, karar veren ya da yedek olduğu alımı salt okur; diğerlerine 404. Kapalı alım herkes için salt okunur; Sahip ve Yönetici "Yeniden aç" ile açar.
- (14) Alım sekmeleri: Genel bakış, Değerlendirme (Özet, Kurucu, AI taslağı, Puan kartı, Önizleme), Ekip ve kurallar. Her sekme ve link rotasıyla aynı görevde eklendi (C7). Adaylar ve Karşılaştır plan 2-3.
- Kütüphanede silme yok, arşiv var: kabul edilmiş AI yetkinliğinin "Geri al"ı onu arşivler (C1).
- `hiring_versions.published_by` ve donmuş satırlardaki kullanıcı bağları `ON DELETE RESTRICT` (C10); kullanıcı silinmez, devre dışı bırakılır.
- Elle yazılan göçler: 0006 değişmezlik tetikleyicileri; 0007 şema korumaları (kısa FK adı, alım ile sürümün kurum bağı, aralık CHECK'leri, yayında `published_at`/`published_by` zorunlu, varsayılan dil dil kümesinde); 0008 tetikleyicilerde `FOR SHARE` kilitleri ve `hiring_version_frozen` kısıt adı; 0009 `locale_set` bir JSON dizisi. Yayın önce alımı, sonra sürümü `FOR UPDATE` ile kilitler (READ COMMITTED); uygulama bir alt satırın üst sürümünü asla değiştirmez (kopyalar, taşımaz).
- Yayındaki ağırlıklar taslak varken de değiştirilebilir: gerekçe ister, eski sürüme yazılan form `STALE` ile reddedilir, tam sayı olmayan ya da 0-100 dışı değer `NOT_WHOLE`, değişiklik yoksa `NO_CHANGE`.
- Alım adındaki ay uygulamanın varsayılan dilinde (TR) yazılır: kurum başına dil yok. Saat dilimi `ORG_TIMEZONE`'dan (sabit Europe/Istanbul yok); son tarih o günün sonu.
- URL bildirimi parametreyi `router.replace` yerine `window.history.replaceState` ile siler: Next bunu yönlendiriciye bağlar ama sunucuya tekrar sormaz, böylece bildirim bir sonraki gezinmeye kadar görünür kalır (router.replace sayfayı parametresiz yeniden çizip bildirimi hemen silerdi).
- AI çağrı sınırı amaç başına: kullanıcı başına 10 / 10 dk, kurum başına 200 / 24 saat (`RATE_LIMITED`); her model çağrısı bir `ai_runs` satırı, çağrı olmadan satır yok.
- HIRING-UX'ten bilerek yapılmayanlar: 5.5 Breadcrumb ve boş taslakta "Kopyala" başlangıcı, 5.6 hata metninde neden, 5.9 ilan metninin 500 karakterde kısalması, 5.10 "1 ile 3 arası" etiketi, örnek ipuçları ve "Skala ekle", 5.18 çoklu Combobox ve "bitiş anketi" anahtarı (kolonu yok), 5.7 `Progress`. Spec'teki `publishVersion` kodda `publishDraft`. Spec 2.1'de olmayan kolonlar: `hiring_versions.org_id`, `previewed_at`, `weights_enabled`, `draft_weights`, zaman damgaları, `hiring_weight_sets.created_by` ve `reason`.
- Spec çelişkileri sonraki planlara bırakıldı: gözetim seviyesinin yayındaki alımda değişmesi (HIRING-UX 5.18) ile sürümün kilitli olması (plan 4); değerlendirici atama modeli, aday başına sayı ve döngü mü, davette panel kopyası mı (plan 2). Plan yazarının yazdığı 24 çapa cümlesi ekip incelemesi bekliyor (`reviewed_at` boş, üründe görünür).

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
