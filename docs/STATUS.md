# Kademe - durum ve devir belgesi

Son güncelleme: 2026-10-06 (işe alım plan 2b, görsel akış ve rehberli panel, `platform/solutions` dalında; bulut oturumunda tip, lint, test ve build ile doğrulandı, veritabanı betikleri ve tarayıcı turu yerel oturumu bekliyor; canlıya çıkmadı).
Önceki: 2026-10-05 (işe alım plan 2, aday akışı, platform/solutions dalında, yerelde doğrulandı; canlıya çıkmadı); 2026-10-04 (çekirdek ayrımı ve işe alım plan 1, kütüphane ve alımlar, `platform/solutions` dalında, yerelde doğrulandı; canlıya çıkmadı).
**Canlıda**: https://kademe.kadiray.com, commit `739f218` (`main`, 2026-10-05 sınav sıcak düzeltmesi; ayrıntı "Kararlar ve sapmalar"da).
Canlı veritabanı kullanıcı onayıyla sıfırlandı: eski işe alım verisi yok,
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
| İşe alım plan 2, aday akışı (yerel, 2026-10-05) | Hepsi bu görevde (plan 2 Görev 21) `380c41f` üstünde çalıştırıldı. `kademe_platform`'da `db:migrate` (0000-0013, yeni göç yok). `tsc --noEmit` ve `eslint src scripts` çıktısız (çıkış 0), `pnpm test` 2164/2164 (169 dosya), `pnpm build` 79 rota (`/_not-found` dahil; yeni: `/a/[token]/practice`, `/a/[token]/stage/[n]`, `/hiring/invite`, `/hiring/openings/[id]/candidates` ve 8 `/api/c/[token]/hiring/*` rotası). Dev sunucusu 3100 `kademe_platform` üstünde: `verify:exam` 24 `ok`, "All checks passed"; `verify:guard` 107 `ok`, 0 FAIL (HIRING terimi olmayan davet her işe alım ucunda bilinmeyen token gibi 404). Ayrı temiz `*_check` veritabanlarında (0000-0013): `verify:hiring-flow` 152 `ok`, `verify:hiring-setup` 188 `ok`, `verify:hiring-immutability` 43 `ok`, üçü de 0 FAIL, "all checks passed"; veritabanları silindi. Parmak izi: `drizzle-kit push` günlüğü temiz, push ile göç veritabanı `IDENTICAL` (895 satır). Em-dash taraması (`git diff --name-only --diff-filter=d 794b363 HEAD`, 214 dosya): eşleşme yok. Yasak kelime taraması (aday mesajlarında `hiring*` ad alanları, 592 metin): 2 eşleşme, ikisi de İngilizce "while" içindeki "hile" (yanlış pozitif), gerçek eşleşme yok. Sayfa düzeyinde sızıntı taraması (C10, `dev:hiring-link --sentinels`, atılabilir `kademe_ui_check`, belge ve `RSC: 1`): giriş sayfası yazılı ve tam fikstürde LEAKVISIBLE 1/1, aşama 1 yazılı 4/4, tam 4/4, aşama 2 yazılı 1/1, bitiş 1/1; her birinde TEAMSECRET 0, ekip alan adları 0, yetkinlik id'si 0 (8 id arandı; veritabanında 3 etkinlikte TEAMSECRET değeri var). Genel bakış RSC'si (5 anket cevabı, tarih 2001-02-03'e çekildi): 3 yorum düz metin, `"rating"` 0, tarih 0, TEAMSECRET 0, ortalama 3/5. Chrome turu (Claude in Chrome, `kademe_ui_check`, PROCTOR_DEV_FAKE kapalı; gerçek cihaz değil, sentetik akış: kamera ve mikrofon yerine sayfa içi sentetik akış, gerçek izin istemi yok): A1 yazılı link açılıştan ilk soruya 21,9 sn, tam fikstürde cihaz kontrolü `/check` açılışından "Her şey hazır"a 49,5 sn (otomasyon süresi, insan süresi değil); A3 giriş sayfası aşama sayısı, tahmini süre, son gün, değerlendirici sayısı, AI'nın yaptığı ve yapmadığı, kaydedilenler, saklama (180 / 730 gün, "Ayrıntılar"), veri hakları linkini "Başlayalım"dan önce söylüyor; tam turda `media_assets`: AUDIO için `audio/webm;codecs=opus`, dosya sorusu için `application/pdf` (cevap dosyası), video yazılı alternatifle cevaplandığı için video kaydı yok, ısınma ve deneme kaydı 0 satır, gözetim satırı 0, `proctor_level` OFF; listede olmayan medya türü 0; A4 ısınmada sunucuya 0 istek; A5 düşünme süresi bitince `getUserMedia` çağrısı 2'den 2'de kaldı; A6 +%25 gerekçe alanı olmadan seçildi (15 → 19 dk, aşama 10 → 13 dk, veritabanında 25), sahip Adaylar sekmesinde yalnız "Süre uyarlaması uygulandı" gördü, RSC'de yüzde ve gerekçe 0 eşleşme; düzeltme: fikstürde davetin tek (atanmış) değerlendiricisi sahipti, yani bayrağı gören kişi o davetin değerlendiricisiydi (A6'ya aykırı, son inceleme I3; son düzeltme dalgasında giderildi: davetin panelindeki yürütücü artık görmez). Değerlendirici rolüyle bakılan hesap kopyada SQL ile alım ekibine eklenmişti ama davetin paneline atanmamıştı; onun satırında süre satırı yoktu; A7 tek tıkla yazılı alternatif, `used_text_alternative = t`; A8 9:19, yenileme, "Kaldığın yerden devam ediyorsun, 9:16 kaldı", ikinci yenileme 9:10 (ilk okumadan 9,1 sn sonra), cevap yerinde; A9 bitişte "12 Eki tarihine kadar sana dönülecek" ve `deniz@ornek.test`, aynı link `/done`'a gidiyor, durum satırı plan 3; A10 işlenmiş sayfalarda yasak kelime 0, em-dash 0; A11 axe-core 4.12.0 (cdnjs) giriş, kontrol, ısınma, aşama girişi, yazılı, tek seçim, video, dosya, bitiş sayfalarında serious/critical 0 (yalnız moderate `page-has-heading-one`), panelde genel bakış, kurallar, adaylar, davet sayfalarında serious/critical 0 (moderate `region`); R14 Bugün "Davet et"ten "Linki kopyala"ya 34,3 sn (otomasyon), form dolduktan sonra 2 tık. Ekran görüntüleri: oturum scratchpad'i `shots/p2t21-*` (34 dosya). `kademe_platform` satır sayıları sonunda başlangıçla aynı (`diff` boş, 51 tablo, işe alım satırı 0) |
| İşe alım plan 2b, görsel akış ve rehberli panel (bulut oturumu, 2026-10-06) | Görev 23'te `4c260ac` üstünde (Görev 1-22'nin kodu, bu görevin belge değişikliğinden önce), Claude Code web bulut kabında çalıştırıldı (Node 22.22, ICU 77; PostgreSQL ve Docker yok; tarayıcı yok). `tsc --noEmit` ve `eslint src scripts` çıktısız, çıkış 0. `vitest run` 2723 test, 220 dosya: 2722 geçti, 1 düştü: `src/solutions/hiring/rules/invitation.test.ts` "names the time and the zone" (ortam: bu kabın ICU 77'si "Türkiye Standart Saati" yerine "Türkiye Saati" yazar; önceki yerel oturumlarda geçti; kod değişmedi). Görev 1'in commit'inde (`057d268`) 2264 test vardı; plan boyunca sayı yalnız arttı, yeniden adlandırılan her test adı defterde kayıtlı. `pnpm build` (sahte `DATABASE_URL=postgresql://kademe:kademe@localhost:1/none`, defter hükmü, hiçbir yere bağlanılmaz) çıkış 0, 79 rota (`/_not-found` dahil), plan 2 ile aynı: `53acc8f` ile HEAD arasında `src/app` altında eklenen ya da silinen `page`/`route` dosyası yok (iki uçta 78 dosya; 12 sayfa yalnız değişti), akışlar hash'te (D13). Em-dash taraması (`git diff --name-only --diff-filter=d 53acc8f HEAD`, 203 dosya, bayt araması): 1 eşleşme, buluta devirde kopyalanan plan 2 defterinin başlığı (`docs/superpowers/ledgers/2026-10-05-hiring-candidate-flow/progress.md:1`); bu görevde virgülle düzeltildi, yeniden taramada eşleşme yok. `vitest run src/i18n` 4 dosya, 43 test geçti (aday metinlerinde yasak kelimeler, `flow` ve `today` dahil ortak panel ad alanlarında "sen", sözlüklerde em-dash, TR/EN anahtar eşitliği). Sızıntı kuralları için kısmi kanıt, **birim ve render testleri, sayfa taraması değil**: `src/solutions/hiring/candidate/pages.test.ts` (C10 nöbetçileri: TEAMSECRET 0, LEAKVISIBLE en az 1; telefon beş kapılı sayfanın hepsinde yalnız `DesktopOnlyScreen` görür, aşama adı ve soru yok, döndürülen ağacın tamamı taranır; sorun kartları yalnız aday bilgisi taşır), `candidate-safe.test.ts`, `candidate-state.test.ts`, `stage-layout.test.ts`, `api/c/[token]/hiring/stage/submit/route.test.ts`; H9 için `src/app/(manager)/hiring/openings/cockpit.test.ts` (değerlendirici: yalnız sayı, talep alanı yok, kurulum ve ekip satırı yok, her satır "Aç") ve `openings/[id]/page.test.ts` (değerlendiriciye yalnız dolan link sayısı, talepler hiç okunmaz, "Kopyala" ve kapatma sözü yok). D14 süreleri (Görev 18) yalnız sahte veritabanında, **sentetik**: ifade başına 3 ms gecikmeyle yaklaşık 360 ms; ilk taslağın kurulum yolu her zaman hesaplanır, 300 ms bütçesinden sonrakiler "Kuruluma devam et"e düşer; gerçek Postgres'te ölçülmedi. **Doğrulanmadı (bulut oturumu, Postgres yok):** `verify:exam`, `verify:guard`, temiz `*_check` veritabanlarında `db:migrate` ile `verify:hiring-flow`, `verify:hiring-setup`, `verify:hiring-immutability`, `kademe_platform`'un `audit_logs`, `message_outbox`, `assessments` satır sayıları (önce / sonra), D14'ün 10 taslakla gerçek ölçümü. **Doğrulanmadı (bulut, tarayıcı yok):** sayfa düzeyinde sızıntı taraması (belge ve `RSC: 1`, telefon UA'sı, değerlendirici olarak panel metni), axe-core taraması, klavye turu, kabul listesinin 1440 / 1280 / 1024 yürüyüşü; ekran görüntüsü klasörü yok. Yerel oturumda çalıştırılacakların tam listesi: "Hâlâ doğrulanmadı" madde 26. |

## Canlıda gerçek cihazla doğrulandı (2026-09-30, kullanıcının Chrome'u, macOS)

Test öğrencisi "Test Öğrenci (Kadir)" ile uçtan uca, veritabanından kontrol edildi:
gerçek kamera ve mikrofon (önizlemede yüz), MediaPipe gerçek yüzde (yüz sayısı 1),
oda sessizliği kalibrasyonu, tüm ekran paylaşımı, tam ekran, başlangıç ve periyodik
kareler, sekme/pencere değişimi olayları ve ihlal ekran kareleri, Gemini ikinci bakışı
(ekranda sınav yerine terminal görünen anı CONFIRMED, temiz kareleri NOT_CONFIRMED
dedi), uyarlanabilir dilbilgisi (10 soruda SE hedefine ulaştı), gerçek konuşma kaydı
(video/mp4) → ElevenLabs Scribe (Almanca) → Gemini puanlama önerisi, yazma puanlaması.
Zamanlayıcılar 1-2 dakikada bir çalıştığı için transkripsiyon ve puanlama bu kadar gecikir.

## Hazır işe alım şablonları (2026-10-06, `platform/solutions`, canlıda değil)

Plan: `docs/superpowers/plans/2026-10-06-hiring-ready-templates.md`, spec aynı tarihli, ledger her kararla
`docs/superpowers/ledgers/2026-10-06-hiring-ready-templates/progress.md`.

- 20 şablon (`src/solutions/hiring/templates/`): 8 genel, 8 dil okulu (4 Almanca öğretmeni + ortak "Almanca
  yeterlik" aşaması, kurs danışmanı, öğrenci işleri, eğitim koordinatörü, sınav sorumlusu), 4 ek rol.
  8 yeni yetkinlik (accuracy, didactics, german_proficiency, resilience, integrity, design_craft,
  classroom_management, exam_expertise), 1/3/5 çapalı.
- "Alım aç": "Hazır şablondan başla" ilk kart, "Önerilen"; galeri adımı (`#template`), "Önizle" Sheet.
  `createOpening` `start: "TEMPLATE"`: yetkinlikleri seed_key ya da adla bulur ya da yazar, aşama ve
  soruları, ağırlıkları yazar, boş pozisyonun ilanını ve profilini doldurur.
- Doğrulandı (komut çıktısıyla): tsc 0, eslint 0, `pnpm test` 235 dosya 2971/2971, `pnpm build` 0,
  `verify:hiring-templates` taze `kademe_templates_check` üzerinde 125 ok / 0 FAIL (20 şablonun hepsi
  yayın kapısından geçiyor). Claude in Chrome (kendi sunucu :3101, `kademe_ui_check`): galeri 20 şablon,
  Almanca öğretmeni şablonuyla açılan alımda yayın hazırlığının 3 zorunlu adımı "tamamlandı".
- Doğrulanmadı: "Önizle" Sheet ve uzun promptların aday ekranında görünümü (gerçek tarayıcıda), aday
  akışının bir şablonla baştan sona yapılması, 1 denemelik Almanca video sorusunda kamera arızası
  olursa ne olduğu, gerçek aday süreleri. İçeriği bir İK uzmanı ve bir Almanca öğretmen eğitmeni
  okumadı; telc puanlama ölçütleri yalnız telc ZD B1 Übungstest PDF'ine dayanıyor.
- Ertelenen küçükler ledger'da ("minor (deferred)"); hiçbiri yayını engellemiyor.
- Sıradaki ayrı iş: Sınav tarafında 3 seviye şablonu (hızlı tarama, yerleştirme, 4 beceri) ve banka
  genişletme (spec bölüm 8).

## Hâlâ doğrulanmadı

1. Telefonun kamerada gerçekten algılanması ve bakış işareti (canlı testte oluşmadı).
2. Ses algılama eşiği: canlı testte 4 "konuşma sesi" işareti oluştu; gerçek mi yanlış
   alarm mı bilinmiyor, öğretmen karelere bakıp karar verir.
3. Çift monitör, Firefox / Safari, telefonda engel ekranı.
4. Dinleme seslerinin telaffuz kalitesi (dinlenmedi).
5. Çekirdek ayrımı canlıda uygulanmadı. Canlı göç ayrı onay ister: önce canlı yedeğin yerel kopyasında (5434) prova, sonra pencerede sırayla devam eden sınav kontrolü, servis ve zamanlayıcıları durdur, `pg_dump`, yeni kodu çek ve kur, sayım yakala, parmak izi karşılaştır, `pnpm db:migrate --adopt-baseline`, `verify:migration check`, build, başlat. Ayrıntı ve geri dönüş: "Canlıya çıkış" bölümü.
6. Çekirdek ayrımından sonra gerçek cihazla (sahte medya kapalı) uçtan uca sınav.
7. İşe alımın aday akışı dalda açık (plan 2, `candidateFlowLive: true`, yalnız `platform/solutions` dalında ve yerelde): davet edilen aday giriş, onay, cihaz kontrolü, ısınma, aşamalar, bitiş ve anketi tamamlayabilir; işe alım terimi olmayan davet bilinmeyen token gibi cevaplanır. Kalanlar: inceleme, karar, karşılaştırma plan 3; gözetim plan 4. Adayın karar sonrası durum satırı ve durum ucu plan 3. Plan 2'de aday hiç izlenmez: her davette `proctor_level` OFF donar, tarayıcı gözetim motoru işe alımda başlamaz, giriş sayfası "Ekranın, sekmelerin ve pencerelerin izlenmez" der. Bu akışta gerçek cihazla ve Chrome turunda doğrulanmayanlar: madde 19.
8. Chrome turunda `/dashboard` üstünde 48 saat içinde dolacak link yoktu, bu yüzden link uzatma ve geri alma şeridi bu turda denenmedi.
9. Canlıya çıkış ve geri dönüş adımları VM'de ve Neon'da hiç çalıştırılmadı. Doğrulanmayanlar: canlı `DATABASE_URL`'in pooler olup olmadığı ve pooler'ın `lock_timeout` parametresini gerçekten reddedip reddetmediği, VM'deki `pg_dump`/`pg_restore`/`psql` sürümleri (ve kurulu olup olmadıkları), Neon'un sunucu sürümü ve parmak izinde yazım farkı çıkıp çıkmayacağı, Neon'da `public` şemasını düşürüp yeniden yaratma yetkisi, canlıdaki şema listesi, `systemctl stop 'kademe-*.service'` kalıbının VM'deki birimlerle eşleşmesi.
10. Saklamanın `attempt_id` birleşimi, kesinleşmiş sonuca bağlı medya üstünde hiç çalışmadı (yerel veride böyle medya yok); canlı kopyada `verify-retention.ts` ile denenecek.
11. Canlı veritabanına 0004-0009 göçleri (kütüphane, alımlar, değişmezlik tetikleyicileri, şema korumaları) uygulanmadı; canlıya çıkış ayrı onay. Yerel prova 0009'a kadar ve geri dönüşüyle yapıldı ("Doğrulananlar"). Başlangıç kütüphanesi canlıya göçle ya da `pnpm db:seed-library` ile gitmez (o komut yalnız yereldir): kurum, kütüphane boşken `/library/competencies`'teki "Başlangıç içeriğini ekle" düğmesiyle ekler. Canlı veritabanı rolü işe alım tablolarının sahibi ya da süper kullanıcı olmamalı (tetikleyiciler uygulama hatasına karşı korur, yetkili kişiye karşı değil); sahip olmayan bir rol `hiring_versions` ve `competencies` üstünde UPDATE yetkisine ihtiyaç duyar (`FOR SHARE` bunu ister). VM'de ve Neon'da doğrulanmadı.
    **Plan 2 ile (2026-10-05):** 0010-0013 göçleri (aday akışı tabloları, `candidate_requests`, kurum bağlı anahtarlar, `hiring_stage_runs.closed_by`, `hiring_assessments.feedback_by`) da canlıda ve paylaşılan yerel `kademe`'de uygulanmadı; yalnız `kademe_platform`'da ve atılabilir `*_check` veritabanlarında var. 0010-0013 için yerel geri dönüş provası yapılmadı (son prova 0009'a kadar). Sahip olmayan canlı rolü, koddaki satır kilitleri yüzünden şu tablolarda UPDATE yetkisine ihtiyaç duyar (PostgreSQL `FOR UPDATE`, `FOR NO KEY UPDATE` ve `FOR SHARE` için UPDATE ister; liste `src` içinde `.for(` aranarak çıkarıldı): `organizations` (`FOR NO KEY UPDATE`, `consent.ts`), `attempts` (`FOR NO KEY UPDATE`, `candidate.ts`), `hiring_openings` (`FOR UPDATE` ve `FOR SHARE`, `openings.ts`, `versions.ts`, `invitations.ts`), `hiring_versions` (`FOR UPDATE`, `publish.ts`; tetikleyicilerde `FOR SHARE`), `competencies` (`FOR SHARE` ve `FOR UPDATE`, `publish.ts`, `library-write.ts`), `positions` (`FOR UPDATE`, `library-write.ts`), `hiring_assessments`, `assessment_links`, `candidate_requests` (`FOR UPDATE`, `invitations.ts`), `hiring_responses` (`FOR UPDATE`, `candidate.ts`), sınavın `section_runs`'ı (`FOR UPDATE`, `exam-flow.ts`). Ayrıca iki işlem içi danışma kilidi (`pg_advisory_xact_lock`: davet tekrarı `invitations.ts`, aday talebi `candidate-requests.ts`); bunlar ek tablo yetkisi istemez. Rolün bu yetkileri canlıda doğrulanmadı.
12. Canlı AI: üç amaç da canlı çağrıyla görüldü (ANCHOR_DRAFT Görev 7'de Gemini, HIRING_DRAFT Görev 17'de Gemini, QUESTION_CHECK Görev 18'de ve son Chrome turunda Gemini). Son turdaki HIRING_DRAFT isteğinde Gemini 503 verdi, istek NVIDIA yedeğine (`nvidia/nemotron-3-ultra-550b-a55b`) düştü ve 3,0 dakika sürdü (ekran artık 40 sn sonra "Hâlâ çalışıyor; sağlayıcı yavaş yanıt veriyor" diyor, istemci tarafında süre sınırı yok); 2 `ai_runs` satırı (biri hata kaydı). Yedek modelin taslak kalitesi ayrıca değerlendirilmedi.
13. Chrome turunda görülmeyenler: AI'nın yeni yetkinlik kartını kabul etmek (bu turda görünür bir yetkinlik kartı gelmedi, 1 öneri ilanda dayanağı olmadığı için gizlendi), eksik çapa yüzünden kapalı "Yayınla" (başlangıç yetkinliklerinin çapaları tam; kapı `verify:hiring-setup` ile doğrulandı), Değerlendirici rolüyle erişim, alımı kapatma ve yeniden açma, yeni yetkinlik ve skala düzenleme, hata durumları. HIRING-UX 2.1'den bu turda görülenler: R2 kısmen (hazırlık satırı, Sheet'te 1/3/5), R12 kısmen (AI ekranı metni, yalnızca HIRING_DRAFT ve QUESTION_CHECK satırları), E1 (12 sayfada tek dolu buton, kapalı butonlar nedenini yanında söylüyor), E2 kısmen (boş pozisyon listesi, AI "Hazırlanıyor"), E3 (TR ve EN; anahtar eşitliği testte), E4 göz kontrolü, E5 (sayfa metinleri ve dosya taraması). 2.1'in geri kalanı doğrulanmadı.
14. Elle klavye kontrolleri: "Soru ekle" menüsünde ok ve harfle gezinme denenmedi; çapa Sheet'inde Escape otomasyonla denendi (kapandı, odak "Düzenle"ye döndü), Radix seçimde ok tuşu otomasyonla denendi (Ekip ve kurallar'da ilk denemede seçim değişmedi, nedeni bilinmiyor; ikinci denemede vurgu 2'den 1'e geçti ve Enter seçti), gerçek klavyeyle değil. Otomasyon Chrome penceresini yeniden boyutlandıramadığı için dar genişlikler önceki görevlerde iframe içinde kontrol edildi; gerçek dar pencere doğrulanmadı. 1280 genişlikte kurucunun panelleri alt alta diziliyor (editör 712 px, eşik ~740 px).
15. Son düzeltme dalgası yapıldı (aşağıdaki "Son düzeltme dalgası"). Bilerek sonraki planlara bırakılanlar: registry testinin menü etiketlerini TR/EN tekrar doğrulaması; yayın kapısının ulaşılamaz `NOT_WHOLE` kodu; puan kartında daha kısa ekran okuyucu sütun adları; yeni sürüm anahtarına eski AI oturumunun yazılması (kendini düzeltir); önizleme ilerleme çubuğu ile aşama metninin tanımı (plan 2); her otomatik kayıtta tüm kurucunun yeniden doğrulanması (plan 2 ölçeğinde ölçülecek); ağırlık setlerinin tetikleyiciyle dondurulmaması (plan 3). **Plan 2 kapanışında (hüküm C16):** plan 1'in iki devri plan 2'de yapılmadı ve açıkça plan 3'e bırakıldı: ağırlık formunun `currentWeightSet`'i içeriğe göre eşlemesi (A -> benim -> B -> A sırasında yanlış set) ve her otomatik kayıtta tüm kurucunun yeniden doğrulanması (`revalidate`); ikincisi plan 2 ölçeğinde de ölçülmedi.
16. next-intl `ENVIRONMENT_FALLBACK` uyarısı giderildi (yönetici ve aday sağlayıcıları `ORG_TIMEZONE`'u sunucudan alıyor; dev günlüğünde uyarı yok). İstemci bileşeninde biçimlenen tarih (`LinkProblem`) varsayılan bölgeyi kullanır; `ORG_TIMEZONE` varsayılandan farklı ayarlanırsa orada sunucu ile tarayıcı farklı gün yazabilir, doğrulanmadı.
17. Kullanıcıya sorulacak tasarım noktası: kurucudaki koyu "Sadece ekip görür" paneli HIRING-UX 5.5'e göre; daha açık isteniyorsa karar kullanıcıda.
18. İşe alım bitiş ekranı (plan 2 Görev 16) adaya tarihli bir geri dönüş sözü veriyor: tamamlanma günü (`ORG_TIMEZONE`) + alımın geri dönüş günü, tamamlanırken `hiring_assessments.feedback_by`'a dondurulur (göç 0013; yalnız yerel `kademe_platform`'a ve geçici `*_check` veritabanlarına uygulandı). Ekip tarafı bu tarihi henüz izlemiyor: aday başına "Geri dönüş: <tarih>" ve Bugün'de gecikme durumu plan 3.
19. Plan 2 Chrome turunda (2026-10-05) doğrulanmayanlar: A2, gerçek kamera ve mikrofon, iPhone Safari, Android Chrome: doğrulanmadı, gerçek cihazla kullanıcıyla (bu oturumda kullanıcı çalıştırmadı; bütün kayıt yolları sayfa içi sentetik akışla koştu). A12: pilot (yerelde ölçülemez). Aşamanın çevrimdışı şeridi: doğrulanmadı (otomasyon sekmesi kendi ağını kesemez; kullanıcı DevTools'ta çevrimdışı yaparsa görülür). Adaylar sekmesinin boş durumu bu turda görülmedi (bütün fikstür alımlarında aday vardı). "Linki kopyala" tıklandı ama "Kopyalandı" yazısı otomasyonda görünmedi; panoya gerçekten yazıldığı doğrulanmadı. Tam turda video sorusu yazılı alternatifle cevaplandı, bu turda video kaydı ve yüklemesi görülmedi (Görev 14'te sentetik akışla görüldü). Ayrı bilgi sayfası (`/info`) bu turda görülmedi (ad ve e-posta davetle geldi; Görev 12'de görüldü). Klavye turu yalnız aşama girişinde yapıldı (İngilizce, Yardım, Aşamayı başlat; hepsi 2 px çerçeveyle görünür), seçim tuşları 1 ve 1-2 çalıştı; ok tuşları denenmedi. Yalnız 1280 genişlik; dar genişlik bu turda denenmedi. R14 süresi (34,3 sn) ve A1 süreleri (21,9 sn, 49,5 sn) otomasyon süresidir, insan süresi değildir. Dokunma hedefleri: 44 px'ten küçük görünen öğeler yalnız Radix radyo ve onay kutusu göstergeleri (16-20 px; tıklanabilir etiketleri 582x44, 640x56, 520x44, anket karoları 122x48) ve gizli dosya girdisi.
20. Plan 2 açık kıyaslama (benchmark) maddeleri, gerçek cihazla kullanıcıyla: gerçek kamera, mikrofon ve deneme kaydını dinleme; sessiz okuyan mikrofon ve iOS Safari'de askıda kalan AudioContext; uygulama içi tarayıcılar (LinkedIn, Instagram); iPad; HEARD_AT (0,06) ve 2 Mbps eşiklerinin ayarı; sınavda gerçek kamerayla Chrome MP4 parça aralığı (Görev 14'te sentetik akışla Chrome MP4 verisi yalnız durdurunca geldi); Safari'de değerlendiricinin WebM oynatması (plan 3); VoiceOver (aşama bitti satırı); radyo gruplarında gerçek klavye okları; gerçek ağ kopması; ALLOW_LATE ve ALLOW_GRACE canlı; R2 hiç denenmedi (depolama hâlâ yerel disk, parça birleştirme yalnız birim testi ve yerel prova).
21. Plan 3'e bağlayıcı devirler (plan 2 defterinden): veri hakları taleplerini işleyecek yer, KVKK cevap süresi görünür (`deletion_requests`, iki çözüm); anket cevabı silinince ya da saklama süresiyle düşünce farktan puan ve yorum çıkarılamaması; anket yorumuna yazılan adın kör moddaki Değerlendiricilere görünmesi (karar plan 3); aday başına "Geri dönüş: <tarih>" ve Bugün'de gecikme; değerlendiriciler için WebM'in yeniden paketlenmesi ya da H.264/AAC MP4'e çevrilmesi (Safari oynatma ve Scribe WebM kontrolü plan 3 kabul maddesi); yayında iletişim e-postası zorunlu; tekrar sınavda `feedback_by`'ın yeniden dondurulması (teyit); huniye aşama içi süre; tahmine adaya özel ek süre; Adaylar sekmesinin yeniden tasarımı (V8). Son incelemeden (2026-10-05) eklenen bağlayıcı devirler: Görev 1'in saklama devri (temizlik, adayın yazdığı metni ve boşta kalan medya id'lerini de temizler); I7 (işe alım kararları medya saklama süresinin başlangıç noktasını besler; plan 2'de işe alım kararı yok).
22. `verify:guard` her çalıştığı veritabanında 1 `audit_logs` (`student.invite`) ve 1 `message_outbox` satırı bırakıyordu (Görev 20'de bulundu). Son düzeltme dalgasında giderildi: betik bu iki satırı da siler ve iki tablonun satır sayısının çalıştırmadan öncekiyle aynı olduğunu kontrol eder. Bu görevde `kademe_platform`'dan `verify:exam`'in 4 adayı ve iki betiğin 5 `audit_logs` ve 5 `message_outbox` satırı çalıştırma zamanına göre silindi; satır sayıları başlangıçla aynı.
23. Bu turda görülen küçük pürüzler (düzeltilmedi, plan 2b ya da son dalga): panelde EN düğmesine öğe referansıyla tıklama dili değiştirmedi (dev sunucusunun sol alttaki "N" rozeti düğmenin üstünde; JS ile tıklama çalıştı; canlı derlemede rozet yok); adayın "English" linkine tıklama 3 sn içinde dili değiştirmedi, `?lang=en` ile açınca değişti; panel EN iken `<html lang>` "tr" kalıyor (kök düzende sabit; aday çerçevesi kendi kabına `lang="en"` koyuyor); yenileme sonrası "Devam et"e ilk tıklama (öğe referansıyla) bir şey yapmadı, ikinci tıklama çalıştı; kayıttan hemen sonra "Sonraki soru" ve "Değerlendirmeyi bitir" 1-2 sn soluk göründü, yanında neden yazmadı; panelde çıkış (Çıkış) kontrolü bulunamadı, Değerlendirici olarak giriş `/login`'den mevcut oturumun üstüne yapıldı. **Plan 2b (2026-10-06):** soluk buton Görev 10'da kapandı ("Bilinen küçük pürüzler"); diğerleri açık.
24. C24: "Ne kaydediliyor" kartı ile saklanan medya türleri örtüşüyor (listede olmayan medya türü 0). Saklanan teknik kayıtlar: linkin ilk açılışında ve onayda IP adresi ve tarayıcı bilgisi (`assessment_links.first_seen_ip`, `first_seen_user_agent`; `consents`), aşama kaydında başlama ve teslim zamanı, `was_late` ve `closed_by` (aday mı saat mi kapattı), yüklemelerin tamamlanıp tamamlanmadığı, bağlantının son görüldüğü an. **Hüküm (2026-10-05, son inceleme):** bunlar teknik kayıttır ve adaya söylenmelidir. Son düzeltme dalgasında söyleniyor: yerleşik onay metni (TR ve EN aynı içerik) ve giriş sayfasının teknik kayıt satırı hepsini sayıyor ("yeniden hak" sözü kaldırıldı, tekrar hakkı yok). Kurumun en yeni metni eski yerleşik metinse sıradaki davette yeni sürüm yazılır; gönderilmiş davetler dondurdukları metni korur.
25. Planlayıcının açık sorularından hükme bağlanmamış olan: HIRING-UX 6.1'deki 60 saniyelik "Nasıl işliyor" videosu yapılmadı, yapılıp yapılmayacağı kullanıcı kararı. Diğer dokuz soru defterde hükme bağlandı (ayrıntı "Kararlar ve sapmalar").
26. **Plan 2b, yerel oturumda kullanıcının Chrome'unda çalıştırılacaklar (Görev 23 bulutta yapılamadı).** (a) Postgres ile, plan Görev 23 Adım 3: dev sunucusu 3100 `kademe_platform` üstünde (önce `pg_stat_activity`'ye bak), `audit_logs`, `message_outbox`, `assessments` sayımı, `DATABASE_URL=postgresql://kademe:kademe@localhost:5434/kademe_platform pnpm verify:exam` ve `pnpm verify:guard`, sayımlar yeniden ve eşit; temiz `kademe_flow_check` üstünde (her komut kendi `DATABASE_URL`'iyle, hüküm C13) `pnpm db:migrate`, `verify:hiring-flow`, `verify:hiring-setup`, `verify:hiring-immutability`, sonra veritabanı silinir; beklenen her satır `ok`, 0 FAIL. (b) Adım 5, sayfa düzeyinde sızıntı taraması (C10): `kademe_ui_check`'te `pnpm dev:hiring-link --sentinels`, giriş (iki adım), `/check`, bir aşama, `/done` ve telefon ekranı (`curl -A "<iPhone UA>"`) için belge ve `curl -H "RSC: 1"`: TEAMSECRET 0, LEAKVISIBLE sürüm metni gösteren ekranda en az 1 (telefon ve `/check`'te pozitif kontrol aynı linkin girişi ve masaüstü UA'sı); panelde `/login`'den değerlendirici olarak `/hiring/openings` ve Genel bakış metni (`get_page_text`): talep sayısı, ekip satırı, kurulum adımı yok, her satır "Aç". (c) Adım 6, axe-core (cdnjs) şu ekranlarda, beklenen serious/critical 0, moderate'ler yazılır: Karşılama, Onay, `/info`, `/check`'in üç alt adımı, ısınma, aşama girişi, yazılı, seçmeli, video (düşünme), dosya, anketli ve anketsiz bitiş, süresi dolmuş kart, kapalı kart, ikinci sekme ekranı; panelde `/dashboard` (sahip ve değerlendirici), `/hiring/openings` (sahip ve değerlendirici, kapalılar açık), `/hiring/openings/new` (her adım), bir Genel bakış (kurulum yolu olan taslak, `#publish`, kurallar kartlı yayındaki alım), Ekip ve kurallar (özet, her akışın bir adımı ve özet adımı), davet Sheet'i (kişi, özet, hazır) ve `/hiring/invite` (alım adımı). (d) HIRING-UX 11'deki plan 2b kabul listesinin 22 maddesi 1440, 1280 ve 1024'te, bir tam aday turu ve bir tam ekip akışı yalnız klavyeyle; her madde görüldü ya da nedeniyle "doğrulanmadı". (e) Defterin görev başına açık kıyaslama (benchmark) maddeleri: Görev 2 (telefon ve tablette istemci çizimi ve kopyalama, Mac UA'lı iPad'in hidrasyon penceresi), Görev 6 (Onay'dan `/info`'ya ve `/check`'ten `/practice`'e odak, iki ayrıntı alanının ekran okuyucu adı), Görev 8 (gerçek izin istemi, site ayarında gerçek engel, dil değişiminden sonra istemsiz yeniden açılma, her alt adımda yeni başlığa odak, kaydedicisiz ekran), Görev 9 (gerçek video ve ses kaydı, halka sayaçlar, ses seviyesi çubukları ve kayıt rozeti, 8 sn şeridi, süre dolunca kayıt, dil linki kayıt bitene kadar tutulurken zorla kapanış), Görev 10 (soluk butonun canlı yeniden üretimi, aşama girişi, footer, yazılı ve seçmeli ekranlar, 1-9 tuşları, odak geçişleri, şeridin yeri), Görev 11 ("Dosya seç"ten seçicinin açılması, sürükle bırak, odak halkası, dil linkinde yükleme metni, isteğe bağlı dosya sorusunu atlama), Görev 12 (`/done` 1440 / 1280 / 1024, ok tuşlarıyla puan, gönder, yenile, anketsiz sayfa), Görev 13 (sorun kartları), Görev 14 (18 px menü ikonları, sınav sayfalarının başlığı önce / sonra, hata sayfası), Görev 15 (`#adım` ile yenilemede odak alınmaması, konum duyurusu, kapalı alımın gri noktası, kalın "Link doldu"), Görev 17 (sınavın Bugün'ü önce / sonra, üç rol), Görev 18 (Adım 8'in 1-7. kontrolleri), Görev 19 (`#start`'ta yenile, ad yaz, "Devam et" "İlan metnin var mı?"ya gider, adımlarda geri / ileri), Görev 20 (Adım 8, reddedilen yayının özeti kapatması, `#publish` çevresinde geri / ileri), Görev 21 (dört akış, Genel bakıştan bağlantılar, akışlar arası sıra, kapat ve geri al ile odak), Görev 22 (Sheet ve sayfa turu, 30 sn / 3 tık, 480 x 700 Sheet, 1280 ve 1024 görüntüleri, her başlıkta odak).
27. **Plan 2b, gerçek cihazla kullanıcıyla (doğrulanmadı):** telefonlar, tabletler, klavyeli tablet, gerçek kamera ve mikrofon, Safari'nin kesilen ses bağlamı (askıda AudioContext; Görev 8: tam yeniden yüklemeden sonra kendiliğinden açılan cihazlar jest olmadan AudioContext kurar, askıda kalırsa 1 sn sonra "Evet, devam et" serbest kalır), TikTok ve Snapchat uygulama içi tarayıcıları, dokunmatik dizüstünün engellenmediği. Masaüstü sitesi modunda fareli Android tablet kapıdan geçer (Görev 1 devri, tasarım sınırı).
28. **Plan 2b'den açık kalanlar (karar ya da sonraki plan):** sınavın çekirdek `LinkProblem`'i yeni link talebi başarısız olunca da "Talebin iletildi" der (`src/components/candidate/LinkProblem.tsx:49-57`); işe alımın kendi dürüst kartı var (plan 2b kararı 8), canlı sınavı değiştirmek ayrı bir kullanıcı kararı. Menü sayaçları (P1, "Bugün 6") plan 3'ü bekler (plan kararı 6). Veri hakları talepleri Bugün'de, kontrol görünümünde ve Genel bakışta düz bir notla sayılır; işlendikleri yer ve Bugün'deki en üst sıraları plan 3 ile gelir (hüküm C6, kullanıcı 2026-10-05: "yok plan 3 te gelsin"; sıra `RANK`'te saklı). Plan 2'nin Görev 13 artığı "retry-replaced pending draft" plan 2b kararı 15'teki okumayla düzeltildi (taslak en yeni gönderilmiş metni ve ondan önceki ikisini tutar; Görev 10, hüküm C11). M6 (değerlendirme çalışma alanı), M9 (kütüphane), M10 (ayarlar, kullanıcı daveti, giriş) ve E1 sonraki plana kaldı (HIRING-VISUAL-FLOW 6.1).
29. **Kullanıcıya açık sorular (HIRING-VISUAL-FLOW 7 ve tasarım farkı belgesinin 3. bölümü; her biri önerilen cevapla uygulandı, cevap yereldir):** (1) kontrol görünümü Alımlar sayfasının yerini mi alsın, ayrı bir sayfa mı olsun (H1: Alımlar sayfası); (2) akışlar tam ekran mı, yan menü görünsün mü (W2, D12: yan menü görünür); (3) Ekip ve kurallar dört kısa akış mı, tek uzun akış mı (4.10, D10: dört kısa akış); (4) davetin adım sayısı (D11: kişi, sonra özet; dil ve son gün özetten açılır); (5) sınavın formları (öğrenci ekle, sınav oluştur) da akışa dönsün mü (D15: hayır, K12 canlı sınava uzanmaz); (6) değerlendiriciler ne görsün (H9: yalnız sayı).
30. **Plan 2b son düzeltme dalgası (2026-10-06, bulut; `3f14984`..`fbb3c5d`).** Tüm planın iki incelemesinden (aday ve yönetici tarafı) sonra: kullanıcı kararı U1 ("Düzelt"): bir aşamanın soruları süre başlamadan tarayıcıya gitmez (başlamamış aşama yalnız soru kimliği ve türüyle gider; sayfa ve her API cevabı); kullanıcı kararı U2 ("Kapatılabilsin"): alımı yöneten kişi kapalı alımdaki açık talebi "Tamam" ile kapatabilir (değerlendirici ve başka kurum yine reddedilir). Ayrıca: kayıt kilidi düşünme süresinde değil, kayıt başlarken, kayıtta ve kaydederken; `/check`, aşama girişi ve sorun kartlarında gelişte başlığa odak; yükleme sürerken yenileme en çok 30 sn bekler; girişe aşama adı gitmez, 16 ölü `hiringLanding` anahtarı silindi; ekip adımı yalnız aktif üyeleri sayar; "Yayınla"dan sonra odak; değerlendiricisi olmayan ya da son günü geçmiş alımda "Aday davet et" nedenini söyleyerek bekler; kapalı alımda davet düğmesi yok; Bugün ve kontrol görünümü taslak satırını aynı sayar; Genel bakış okumaları sırayla; tek `HashAwareLink`; aynı sayfadaki sekme hash adımından görünümü geri getirir. `scripts/verify-hiring-flow.ts` yeni duruma göre güncellendi (giriş: `"stageCount":`, aşama girişinde soru metni yok): **yerelde Postgres ile yeniden çalıştırılmalı (doğrulanmadı).** Testler 2783, 2782 geçti, 1 ortam hatası (ICU). Açık küçükler: "Sayfayı yenile"ye bekleme sırasında ikinci basış ikinci yenileme başlatır; kontrol görünümü "son gün geçti"yi bekleyen sayar, Bugün göstermez; hash adımında sekme basışı sorguyu (`?skip=`) korur; `inviteBlock` "yayında değil" kontrolünü atlar (ulaşılamaz).

## Canlıya çıkış (yapılmadı, ayrı onay)

Eski kod ile yeni kod 0001-0003 göçleri boyunca birbiriyle uyumsuz: eski kod yeni şemada, yeni kod eski şemada çalışmaz. Bu yüzden göç sırasında uygulama durdurulur.

Canlıdaki kod `3f2b8a8` (inceleme notuna göre; VM'de `git rev-parse HEAD` ile adım 4'te teyit edilir). O commit'te ne `pnpm verify:migration` ne `pnpm db:migrate` vardır (`git show 3f2b8a8:package.json` ile bakıldı: yalnızca `db:push`, `db:setup`, `db:sql`). Bu yüzden sayım ve göç komutları ancak yeni kod çekilip kurulduktan SONRA çalışır. **2026-10-05 güncellemesi:** sınav sıcak düzeltmesinden sonra canlıdaki kod `739f218` (plan 2 defterine göre); adım 4'te beklenen commit artık budur, geri dönüş de ona yapılır. `739f218`'in `package.json`'unda da `db:migrate` ve `verify:migration` yok (`git show 739f218:package.json` ile bakıldı: `db:push`, `db:sql`, `db:setup`, `db:setup:local`, `db:seed`, `db:reset`).

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

## Plan 2 son düzeltme dalgası (2026-10-05, son inceleme sonrası)

- Canlıdaki sınav düzeltmesi dala alındı: `origin/main` 739f218 (0e12393 sınav maddelerini bölümün kendi işlem bağlantısında sunar, 739f218 parça adresi sorgusunu parçayla birlikte yeniden dener) `platform/solutions`'a normal birleştirmeyle alındı. `exam-flow.ts` dalın sürümü (b49f643 aynı düzeltme), `recorder.ts` dalın `RetryPolicy`'si ve `EXAM_RETRY.retryTargets: true`, main'in testleri dalın testlerinin yanında.
- C24 hükmü (yukarıda madde 24) uygulandı; Görev 1 saklama devri ve I7 plan 3'e bağlayıcı devir (madde 21).
- Ayrıntı ve kapı sayıları: `.superpowers/sdd/2026-10-05-hiring-candidate-flow/final-fix-report.md`.

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

**İşe alım plan 2 (aday akışı, 2026-10-05).** Plan: `docs/superpowers/plans/2026-10-05-hiring-candidate-flow.md`; hükümler `.superpowers/sdd/2026-10-05-hiring-candidate-flow/progress.md`'de.

- Adaylar sekmesinde görünürlük (C12, plan 2 ara kuralı): alımı yürüten (Sahip, Yönetici) adayları adıyla izler; kör mod yalnızca yürütmeyenlerin (Değerlendirici) gördüğü adı ve e-postayı gizler, ek süre ve talepler onlara hiç okunmaz. Plan 3'ün `visibility.ts`'i bunu değiştirir.
- Alımın son günü geçtikten sonra da "Yeni link üret" ve "7 gün uzat" çalışır, alımın son gününe kısılmaz (Görev 7 hükmü); ekran yeni son günü gösterir ("Son gün ...", `ORG_TIMEZONE`).
- "Yeni link üret" geri alınamaz (C9, yayınla gibi): eski link hemen durur; uyarı düğmenin altında görünür metin. "7 gün uzat" işe alımda alımın kendi eylemi (C8: alıma bağlı, kapalı alımda yok, en yeni link, denetim kaydı); çekirdek `extendLink` yalnızca sınav linkini uzatır. Yeni link ya da uzatma adayın açık "Yeni link talebi"ni kapatır.
- Aday talepleri (uyarlama, yeni link) aynı türden açık bir talep varken ikinci kez yazılmaz; aday aynı "iletildi" cevabını alır. Veri hakları talepleri (`deletion_requests`) sekmede görünür ama orada kapatılmaz.
- Veri hakları talepleri (`deletion_requests`: görme, kopya, silme) uygulamanın hiçbir yerinde henüz işlenmiyor ve kapatılmıyor, iki çözümde de (sınav ve işe alım); plan 3 bunları işleyecek yeri ekler (KVKK cevap süresi görünür olarak).
- Kapalı alımda "Yeni link üret" yalnızca başlamış aday için açık (Görev 7 hükmü; satır nedenini söyler); başlamamış adaya yeni link ve "7 gün uzat" kapalı alımda yok. Yerine geçen eski link o an kapanır, adayın kartı ileri bir tarih göstermez.
- Bitiş anketi Genel bakış'ta 5'erli gruplarla açılır (Görev 19 düzeltme turu 1): yalnızca bir günden eski cevapların en eski tam gruplarının ortalaması, sayısı ve en fazla 3 isimsiz yorumu (tarih ve yorum başına puan yok; yorumlar metne göre dizilip alım ve açılan sayıdan tohumlu karıştırılır, her yenilemede aynı; düzeltme turu 2). Aday yorumuna kendi adını yazabilir; bu yorum kör modda Değerlendiricilere de görünür. Plan 3 karar verir (ör. anket yorumlarını Değerlendiriciden gizlemek).
- Bir anket cevabı silinirse (kişi silme, saklama süresi) açılan grubun sayısı ve ortalaması değişir; önceki görünümle karşılaştıran biri silinen cevabın puanını ya da yorumunu çıkarabilir. Plan 3 bunu veri hakları işiyle çözer (bağlayıcı devir, Görev 19 hüküm (c)). Şimdilik yalnızca bir günden eski cevaplar sayılır ve iki okuma arasında silinen bir cevapta kart bekleme durumuna döner.
- Huni süresi duvar saatidir (baştan sona, molalar dahil) ve adaya söylenen tahminle (aşama süreleri + ek süre payı, C25; adaya özel ek süre hariç) karşılaştırılır; plan 3 aşama içi süreyi ekleyebilir.
- **Plan 2'nin HIRING-UX'ten ayrılan kararları (Görev 21 kaydı):**
  - Değerlendirici ataması: davet anında alım ekibinin bütün aktif üyeleri atanır (spec 2.1); HIRING-UX'teki döngü (M kişiden N'i) yapılmadı, plan 3'ün kuyruğuyla gelir. Adaya söylenen sayı `min(alımın en az değerlendirme sayısı, atanan)`.
  - Çoklu seçim yalnız tam küme doğruysa 1, değilse 0 puan alır (kısmi puan yok; `auto_score` gerçek sayı, plan 3 yeniden puanlayabilir).
  - Aday talepleri (uyarlama, yeni link) planın yazdığı gibi `deletion_requests`'te değil, ayrı çekirdek tablo `candidate_requests`'te (hüküm C7); veri hakları talepleri `deletion_requests`'te kalır.
  - Onay metni davet başına dondurulur (`hiring_assessments.consent_text_id`); `hiring_versions.consent_text_id` boş kalır. Plan 4: gözetim seviyesi başına bir `consent_texts` sürümü, yine davete dondurulur.
  - Kapanan alım yalnız başlamamış adayları durdurur; başlamış aday bitirebilir (HIRING-UX söylemiyor; hükümle).
  - HIRING-UX 6.1'deki 60 saniyelik "Nasıl işliyor" videosu yapılmadı.
  - Aşama ek süresi (grace) ayrı bir saat olarak gösterilmez, sunucunun yazdığı son ana eklenir; giriş sayfası ve aşama girişindeki dakikalar onu içerir (C25).
  - `candidateFlowLive` Görev 10'da açıldı (aday ekranlarından önce); Görev 17'ye kadar hiçbir kullanıcı işe alım daveti açamadığı için ulaşılamazdı.
  - "7 gün uzat" işe alımda alımın kendi eylemidir (C8); çekirdek `extendLink` yalnız sınav linkini uzatır.
- **HIRING-UX metin farkları (C22, görev raporlarından):** 6.7 "Cevabı gönder ve devam et" düğmesi soru geçişlerinde "Sonraki soru" oldu (yazılı alternatif ekranında "Cevabı gönder ve devam et" kaldı); 7.2 kapanış cümlesi "İşaretlenen anlara bir insan bakar" yerine hükümdeki söz: "Hiçbir kayıt seni otomatik olarak elemez; kararı cevaplarına bakan insanlar verir." (plan 2'de hiçbir şey işaretlenmez); 5.11 "Linkini yeniden göster?" yerine "Yine de davet et" (token yeniden gösterilemez); 5.4 "Ortalama" yerine ortanca süre ("baştan sona, molalar dahil"); huni adımları süzülmüş link değil; 6.1 madde 4 "ekipten en az N kişi" (N = en az değerlendirme ile atanan ekibin küçüğü; 1 kişide "ekipten bir kişi"); AI cümlesi "video ve ses cevaplarını" yazıya döker der, kayıt yoksa yazıya dökme cümlesi yok; 6.1 madde 6 "Telefon ya da bilgisayar" her zaman yazıyor (plan 2'de gözetim seviyesi yok; plan 2b masaüstü kararıyla değişecek); 6.14 kapalı kart ve iletişim satırı adresi link olarak verir; "Ayrıntılar" ElevenLabs satırını tekrarlamaz (onay metni taşır).
- **Spec farkları (C29):** spec 2.4'teki `hiring_assessments.candidate_status_visible_at` ve `candidate_status_note` plan 3'e (sonraki göç) kaldı; spec 7'deki `stage/heartbeat` ayrı uç değil, çekirdek `/heartbeat` `candidate.heartbeat` ile sunar; spec 8'deki `verify:hiring` adı `verify:hiring-flow`.
- **Kullanıcı kararları (2026-10-05):** işe alımın aday akışı yalnız masaüstü (güvenlik için: gözetim, tam ekran, sekme odağı); telefon ve tablet dürüst bir "bilgisayarda aç" ekranı alır; HIRING-UX 6.15'in telefon maddeleri işe alım için geçersiz, dil sınavı değişmez. Görsel yeniden tasarım plan 3'ten önce "plan 2b" olarak yapılır (`docs/design/HIRING-VISUAL-FLOW.md`; çizimler sınırlı, karşılama ve onay ayrı, düşünme ve cevap için halka sayaç); Adaylar sekmesinin yeniden tasarımı (V8) plan 3'te. Paylaşılan yerel `kademe` veritabanının göçü ve canlıya çıkış ancak en sonda, ayrı onayla.
- **Canlı sıcak düzeltme (2026-10-05, kullanıcı onayıyla, plan 2 defterine göre; bu görevde VM'de yeniden kontrol edilmedi):** `main` `af6fec1..739f218` itildi ve kademe-app'e kuruldu (göç yok): `0e12393` sınavın `ensureCurrentItem`'ında havuz kilitlenmesi (satır kilidi tutan işlem içinde soru anlık görüntüsü ve havuz okuması genel `db` yerine işlemin bağlantısıyla), `739f218` `part-urls` adres sorgusu parçanın kendi üç denemesi içinde. Dal bu iki düzeltmenin kendi kopyalarını taşır: `b49f643` (`exam-flow.ts`, `@/db/executor` ile) ve `573a67f` içindeki `ChunkedUploader` `retryTargets` seçeneği. Dikkat: dalda bu seçenek yalnız işe alımın `PATIENT_RETRY` politikasında açık; sınavın `EXAM_RETRY` politikasında `retryTargets: false` (`src/lib/client/recorder.ts:105`), yani dalda sınavın adres sorgusu hâlâ denemelerin dışında ve `main`'deki `739f218` davranışı dalda sınav için yok. Dal `main`'e birleşirken ikisi elle uzlaştırılmalı ve sınavda `main`'in davranışı korunmalı. Sınavın Chrome MP4 parça aralığı (E2) değiştirilmedi; gerçek kamerayla en sonda denenecek.

**İşe alım plan 2b (görsel akış ve rehberli panel, 2026-10-05 / 2026-10-06).** Plan: `docs/superpowers/plans/2026-10-06-hiring-visual-flow.md`; tasarım `docs/design/HIRING-VISUAL-FLOW.md` sürüm 4 (K1-K8 orada); hükümler ve ertelenen küçükler `docs/superpowers/ledgers/2026-10-06-hiring-visual-flow/progress.md` ve `preflight.md`'de.

- **Kullanıcı kararları:** K9 (2026-10-05): ortak panel ekranları (Bugün, menü, panelin hata sayfası, Ayarlar, Kütüphane) "sen" der; yalnız sınava ait yönetici ekranları bir plan dokunana kadar "siz" kalır. K10 (2026-10-05): Bugün'ün "Sıradaki iş" sırası veri hakkı talebi > uyarlama talebi > karar bekleyen > en eski sınav incelemesi; hüküm C6 ve kullanıcının 2026-10-05 cevabıyla ("yok plan 3 te gelsin") plan 2b'de yalnız uyarlama talebi "Sıradaki iş" olur, veri hakkı talepleri düz bir notla sayılır, ara "Tamam" düğmesi yok. K11 (2026-10-05): "Linki e-postama gönder" gerçek e-posta gönderimine kadar yok (yalnız "Linki kopyala"); klavyeli tabletler tablet gibi engellenir. K12 (2026-10-06, kelimesi kelimesine): "yönetici paneli adım adım olsa daha iyi, çok fazla alan var, kullanması çok karışık, wizard guide şeklinde no brainer bir yönetici paneli, her şeye hakim olabileceğim"; okuma: sihirbaz öncelikli panel (adım başına bir karar) ve her şeyin tek bakışta görüldüğü kontrol görünümü (tasarım sürüm 4). Ayrıca 2026-10-06: ElevenLabs eskisi gibi kullanılır; onaydaki ElevenLabs satırı (olası yurt dışı aktarım, KVKK) ve saklama süreleri ikinci katmanda ("Ayrıntılar") kalır.
- **Tasarım sürüm 4 hükümleri (K12 için, kullanıcı adına alındı):**
  - H1: kontrol görünümü `/hiring/openings`'tir (menüde yine "Alımlar"); yeni rota yok, tek alımın kontrol görünümü Genel bakışı.
  - H2: sihirbaz çok alanlı işler içindir; tek değerli iş tek adım; kurucu ve puan kartı matrisi editör kalır, kurulum yolu rehberlik eder.
  - H3: kayıtlı bir şeyi değiştiren her akışta ve dört ya da daha fazla adımlı oluşturmada ayrı özet adımı; kısa oluşturmada son adım özet satırı taşır.
  - H4: `DirtyBar` yok; çok alanlı düzenleme özet adımında "Kaydet" ile biter.
  - H5: Ekip ve kurallar (M7) plan 2b'ye girdi; M6, M9, M10 sonraki plana kaldı.
  - H6: akıştan çıkış onay sormaz; kaydedilmemiş değer varken bağlantı "Kaydetmeden çık" der.
  - H7: taslak alımın tek dolu butonu "Kuruluma devam et"; "Yayınla" yalnız kurulum yolunun son adımında (yayın özeti) dolu.
  - H8: plan kararı 11 yerine geçti: Açık / Taslak / Kapalı rota sekmeleri yerine tek kontrol listesi (Kurulumda, Yayında, kapalılar açılır alanda), `?tab=` bağlantıları çalışır.
  - H9: değerlendirici kontrol görünümünde yalnız sayı görür (huni, dolan link sayısı); talep, isim, kurulum eylemi yok; satırın tek eylemi "Aç".
  - D10: Ekip ve kurallar dört kısa akış (ekip; aday iletişimi; adil değerlendirme ve anket; ad); her akış tek mevcut eylemle kaydeder, akış dışındaki alanlar yüklendiği gibi gider; başka akışın alanında reddedilen kayıt o akışın adımını açar.
  - D11: davet önce kişi, sonra varsayılanları dolu özet (dil ve son gün "Değiştir" ile kendi adımlarını açar); alım adımı yalnız birden fazla davet edilebilir alım varken sayfada.
  - D12: akış sırasında yan menü görünür kalır (tam ekran değil).
  - D13: adım sayfada hash'te, Sheet'te bellekte; yeni rota yok (rota sayısı 79 kaldı).
  - D14: kontrol görünümünde taslakların kurulum yolları sırayla, 300 ms bütçeyle okunur (`SETUP_BUDGET_MS`); kalanlar sayısız "Kuruluma devam et" der.
  - D15: K12 canlı sınavın formlarına uzanmaz (sınavın formları akışa dönmez; E1 en son, isteğe bağlı).
  - (H ve D'lerin yanlışsa maliyeti tasarımın 0. ve 7. bölümünde ve tasarım farkı belgesinde `.superpowers/sdd/2026-10-06-hiring-visual-flow/design-v4-delta.md`; bu dosya yerel makinededir, bulut kopyasında yok.)
- **Planın kararları:**
  1. Paylaşılan görsel parçalar `src/components/visual/`'de, `src/components/hiring/visual/`'de değil (ESLint çekirdek kuralı; hüküm C12 ile kabul).
  2. Masaüstü kapısı `renderHiringPage`'de, çekirdek `/a/[token]` düzeninde değil; `/done`, `/rights` ve sorun kartları kapılı değil (C12).
  3. Sunucunun cihaz okuması istek dışında masaüstü sayar (`headers()` atarsa; `verify-hiring-flow` yeşil kalır, gerçek masaüstü asla engellenmez).
  4. `StepFooter` dolu butonu tipli `FooterAction`'dan kendisi çizer: kapalı buton yalnız `waitReason`'la, meşgul buton dolu kalır (`aria-disabled` + dönen simge).
  5. Onaydaki "Kopma olursa ekip yeni hak verebilir" satırı çıkarıldı (tekrar hakkı yok); teknik satır saklananları sayar.
  6. Menü sayaçları (P1) plan 3'e ertelendi; ikonlar M1'de (C12).
  7. Bugün'ün iki şeridi: `attention` ("Dikkat isteyenler") ve `task` ("Sıradaki iş" adayları); değerlendiriciye işe alım satırı yok.
  8. İşe alım link sorunları kendi dürüst kartını alır (`HiringLinkProblem`); çekirdek `LinkProblem` değişmedi (madde 28).
  9. Kapalı alımda hiç başlamamış adayın süresi dolmuş ya da henüz açılmamış linki kapalı kartı gösterir (Görev 13'te NOT_YET için de).
  10. `/info` işe alımın kendi ekranı (`InfoStep`); sınavın `InfoForm`'u değişmedi.
  11. ~~Alımlar sayfası rota sekmelerini korur, sekme başına 20'ye kadar kart~~: **H8 ile yerine geçti** (tek sayfada gruplar, `?tab=` korunur); eski Görev 18'in kart ızgarası da **kontrol satırlarıyla yerine geçti (KG1)**.
  12. Alım durum tonları P9'a göre: DRAFT nötr, OPEN etkin, CLOSED `warn` (artık en koyu değil, açık gri).
  13. Yeni alım sihirbazı ilan adımını yalnız yeni pozisyon adında gösterir (C12).
  14. Genel bakışın `⋯` menüsü yalnız bağlantı taşır; menüde yeni kapatma eylemi yok (C12).
  15. Plan 2 Görev 13 artığı "retry-replaced pending draft": taslak en yeni gönderilmiş metni ve ondan önceki ikisini tutar (yorum; hüküm C11 ile kabul).
  16. Tasarım sürüm 4 planın 2. bölümünü (Görev 14-23) yönetir; H8 kararı 11'in yerine geçer.
- **Bölüm 2'nin yerleşim kuralları:** panel parçaları `src/components/manager/`'da, çünkü `src/solutions/boundary.test.ts` işe alımı `src/components/panel/`'den (sınavın paneli) uzak tutar (HIRING-VISUAL-FLOW 5 bu görevde düzeltildi); hedefi hash taşıyan bağlantı (`…/settings#team-members`, `…#publish`) düz `<a>`, `next/link` değil (akışlar adımı `hashchange` ve `popstate` ile okur).
- **Yerine geçen tasarım metinleri:** HIRING-UX 6.15, 8.6, 6 "Ortak kurallar" ve RULES 1, 9 yerine geçti (Görev 2, 3); HIRING-UX 5.3 (Alım aç), 5.11 (davet) ve 5.18'in (Ekip ve kurallar) form düzenleri etkileşim biçimi olarak HIRING-VISUAL-FLOW 4.6, 4.9 ve 4.10 ile yerine geçti (Görev 19, 22, 21); kuralları, alanları ve metinleri geçerli.
- **Bulut oturumu (2026-10-06):** iş Görev 6'nın ortasında Claude Code web'e devredildi. `pnpm build` `.env`'siz kopyada sahte `DATABASE_URL` ile çalışır (hiçbir yere bağlanılmaz; derleme anında bir veritabanı okuması olsaydı sessiz değil yüksek sesle düşerdi). Bulut kabında Postgres ve tarayıcı yok: veritabanı betikleri ve tarayıcı turları yerel oturuma kaldı (madde 26).

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

**İşe alım plan 2b (2026-10-06).**

- "Hâlâ doğrulanmadı" madde 23'ün soluk butonu ("Sonraki soru" ve "Değerlendirmeyi bitir" 1-2 sn nedensiz soluk) Görev 10'da kapandı: koşucunun butonu artık `StepFooter`'dan çizilir, kapalı buton yalnız nedeniyle, meşgul buton dolu kalır (`aria-disabled` ve dönen simge). Adım 1'in tarayıcıda yeniden üretimi yapılamadı (bulut, tarayıcı yok); yerine `runner-footer.test.ts` her koşucu durumunu `StepFooter` üstünden çizer ve nedensiz, doğal olarak kapalı bir buton bulmaz (statik kanıt). Canlı görünüm madde 26'da. Madde 23'ün diğer pürüzleri açık; aday dil bağlantısı Görev 5'te düz `<a>` oldu (tam yükleme), tarayıcıda denenmedi.
- Bulut ortamı: `src/solutions/hiring/rules/invitation.test.ts` "names the time and the zone" yalnız bulut kabında düşer (Node 22.22, ICU 77 "Türkiye Saati" yazar); önceki defterlere göre yerelde geçer. Kod değil, değiştirilmedi.

Tasarımdan plan gereği sapmalar (plan metni böyle istedi; düzeltmek ayrı iş):
- Görev 1: masaüstü sitesi modunda fareli Android tablet kapıdan geçer (tasarım sınırı; madde 27).
- Görev 13: "henüz açılmadı" kartında "takvime ekle" yok (tasarım 3.11; plan çıkarmıştı).
- Görev 13: "henüz açılmadı" kartındaki tarih saat dilimini söylemez (giriş sayfası `zoneLabel` ile söyler).
- Görev 19: Alım aç'ın 2. adımı ikincil bir buton yerine tek dolu butonun etiketini değiştirir ("İlan metni olmadan devam et" / "Devam et"; tasarım 4.6).
- Görev 21: sayfa genişliği 1080, RULES 9'un 1360'ı değil (Alım aç ile aynı).
- Görev 21: "Alımı kapat" çerçeveli buton, tasarım 4.10 metin eylemi der.
- Görev 21: "Son gün yok" seçilip geri dönülünce seçilmiş gün unutulur (W4).
- Görev 21: kayıttan sonra "Geri" akışın eski adımlarını açar, çıkış kullanıcının geldiği görünüme değil kurallar özetine döner (W7).

Defterin ertelenen küçükleri (Görev 6-22; hepsi açık):
- Görev 5 devri: `apiSend` istemci zaman aşımı yok (başlatma, parça hedefleri, tamamlama `AbortController`'sız); dil linkini tutma bağlantısının render testi yok.
- Görev 6: `useArrivalFocus` başlık oluşana kadar her çizimde yeniden dener; başlığı geç gelen gelecekteki bir ekran odağı geç alır (bugün böyle çağıran yok).
- Görev 7: `shouldAutoOpen`'ın satır içi nesne tipi adlı bir takma ad olabilir.
- Görev 8: tam yeniden yüklemeden sonra kendiliğinden açılan cihazlar AudioContext'i jestsiz kurar; askıda kalırsa 1 sn sonra "Evet, devam et" serbest kalır (madde 27).
- Görev 8: soldaki `role=status` ipucu metniyle birlikte bağlanır (duyurulmayabilir) ve footer'ın canlı nedeniyle yarışır; `sentNote` odağı `anySent`'e bağlı.
- Görev 8: otomatik alt adım değişiminde (ses → deneme) odak hâlâ etkin bir footer kontrolünden de ayrılır; kurala uygun, gerçek cihazda bakılacak.
- Görev 8: MediaRecorder yokken deneme "çalındı" diye hatırlanmışsa dinleme adımına kaydedici raporu olmadan varılır (önceden vardı).
- Görev 8: dinleme adımının sessiz ipucu `trialQuiet` yerine `words.mic` metnini kullanır.
- Görev 8: `7440206` commit'inin imza satırı "Claude Sonnet 5.5" der (tarih değiştirilmedi).
- Görev 9: incelemede koşucu kaydederken iki footer butonu da döner (C4'ün harfi); basılan butonda tek simge daha iyi okunur.
- Görev 9: `exhausted` son durumdur ve belgelenmemiş.
- Görev 9: katı düşünme süresinde "Kamera, sen başlatınca açılır" satırı süre bitince kaydın kendiliğinden başladığını söylemez.
- Görev 9: çok çekimli incelemede süre dolunca iki farklı süre doldu satırı görünür (her biri kendi eylemi için doğru).
- Görev 10: `runner-footer.test`'in durum döngüsü nedeni yalnız kapalı etiketlerde sınar (pozitif kontrol gerisini kapsar).
- Görev 10: `help.tsx:15` belge yorumu düzensiz.
- Görev 10: doğal olarak kapalı `#activity-next`'e kurtarma başlığa düşmez; kayıtlı soruda "Tekrar dene" koşucu footer'ını kaldırır, odak `body`'ye düşer (önceden vardı); `useRescueFocus` etkilerinin render testi yok.
- Görev 11: yükleme durumunun `describedBy` / kart değişimi için test yok (iç durum); gösterilen dosya kartına bırakılan dosya artık dosyayı değiştirmez (plan gereği).
- Görev 11: yükleme kurtarması fareyle bırakmada da çalışır (odak `body`'deyken), başlık duyurulur; başarılı yüklemeden sonra odak başlıkta kalır; kurtarma bağlantısının render testi yok.
- Görev 11: `a38a1a7`'de eklenen üç `capture-hold` test adı `8a35521`'de yeniden adlandırıldı, commit gövdesi "yok" der (yanlış; okuyan yok; defterde kayıtlı).
- Görev 12: "Bugün / Cevapların ekibe iletildi." satırı günler sonra açılınca da "Bugün" der (plan gereği, tasarım 3.10); "şu tarihe kadar" satırı geri dönüş günü olmadan da görünür (önceden de böyleydi).
- Görev 13: istemci gezinmesiyle varılan sorun kartı (link dolarken cihaz kontrolünün `/practice`'e geçişi) odağı `body`'de bırakır; `StatusScreen` başlığında `useArrivalFocus` çözer.
- Görev 13: EN sayfada ekibe giden talep notu İngilizce (çekirdek `requestMessage` ile aynı; görünüş).
- Görev 15: hash'li sayfada adımı değiştirmeyen ilk `hashchange` odak anahtarını çevirir ve başlığı bir kez odaklar (böyle çağıran yok); bellek kipindeki sayfa akışı odağı yalnız `enter` ile taşır.
- Görev 15: `useKeepFocus`'un DOM bağlantısı ve `heard` dinleyicisinin render testi yok (saf parçalar test edildi).
- Görev 17: çekirdek Bugün boş kuyruğun başlığı için "language-exam" anahtarına düşer (plan metni); bir manifest bayrağı daha temiz olurdu.
- Görev 17 (tasarım gereği kabul): çalışan satırlar açılır alanın içinde, yalnız açılınca DOM'da.
- Görev 18: `openingCardFacts` canlı her davet id'sini tek `inArray`'de gönderir (Postgres bağ parametresi tavanı ~65k; bugünkü boyutta ulaşılmaz).
- Görev 18: değerlendirici ya da kapalı satırda aynı sayfaya iki bağlantı (KG1 izin verir); `?tab=closed` grubu yalnız tam yüklemede açar (denetimsiz `Disclosure`); `firstAttempts` ilk birincil denemeyi veritabanı sırasıyla tutar (`openingFunnel` ile aynı); `loadCompetencyFacts` iki şeyi yan yana okur.
- Görev 19: `next/link` "İlan metnini pozisyona ekle" akıştan "Kaydetmeden çık" uyarısı olmadan çıkar (önceden de böyleydi); ilan adımının ve `replaceHash` etki sırasının render testi yok (node ortamı, DOM yok).
- Görev 20: özet görünümünde iki `h1` (PanelHeader ve StepScreen); değerlendiricinin "Linklere bak"ı uzatamayacağı yere götürür; içeriği olmayan taslak hiç görünmeyen bir özete "Kuruluma devam et" alır (yalnız tutarsız veride); seçilmiş ama devre dışı karar veren "kimse seçilmedi" diye okunur.
- Görev 21: "Değiştir"den sonra "Özete dön" ve "Geri" birbirine benzer okunur; iki akışlar arası atlamada yalnız ilk köken yeniden açılır; `1154936`'nın commit gövdesinde "Alimi" yazımı (tarih değiştirilmedi).
- Görev 22: dar Sheet footer'ı uzun (geri, iki buton, neden ve notla yaklaşık 220-250 px), neden butonların altında; sayfanın hazır görünümünde "Geri" görünür bir değişiklik olmadan hash'i değiştirir; davetten sonra yalnız seçilmiş dil kaybolacakken de "Kaydetmeden çık" der.
