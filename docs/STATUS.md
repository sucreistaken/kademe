# Kademe - durum ve devir belgesi

Son güncelleme: 2026-09-30. **Canlıda**: https://kademe.kadiray.com, commit `3f2b8a8`
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
pnpm db:reset               # SADECE yerel DB (5434 değilse reddeder): şemayı sıfırlar
pnpm db:seed                # banka + sınavlar + 3 öğrenci; dinleme sesleri önbellekten
pnpm dev --port 3100
```

- Panel: `kadiraycareer@gmail.com` / `kademe-dev-2026` (öğretmen: `ogretmen@kademe.local`, aynı parola)
- Yeni öğrenci linki: `pnpm dev:link` (seviye tespiti), `pnpm dev:link --claimed B1` (doğrulama)
- Sahte kamera/ekran yalnızca otomasyon testi için: `.env` içinde `PROCTOR_DEV_FAKE=1`. **Varsayılan kapalı.** Açıkken öğrenci sayfalarının üstünde kırmızı "DEV" şeridi çıkar; gerçek cihaz testinden önce kapatın. Üretimde hiç çalışmaz.
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

## DOĞRULANMADI (gerçek tarayıcıda, gerçek cihazla denenmeli)

Otomasyon sekmesinde kamera izni ve gerçek tam ekran yok. Şunlar hiç denenmedi:

1. Gerçek kamera ve mikrofon ile sistem kontrolü ve MediaPipe'ın gerçek yüzde çalışması
   (yüz sayısı, bakış, telefon). Baş açısı işareti (aşağı bakış negatif) varsayımdır.
2. Gerçek `getDisplayMedia` seçicisi, "Tüm ekran" doğrulaması, macOS Ekran Kaydı izni.
3. Gerçek tam ekran, Esc davranışı, `keyboard.lock`.
4. Çift monitör ve sınav ortasında monitör takma.
5. Firefox / Safari (ikinci ekran doğrulanamaz görünmeli), telefonda engel ekranı.
6. Gerçek konuşma kaydının ElevenLabs Scribe ile transkripsiyonu ve ardından AI puanlama
   zinciri (her parça ayrı ayrı doğrulandı, zincir gerçek sesle hiç koşmadı).
7. Ses etkinliği algılama (VAD) eşiği gerçek odada.
8. Dinleme seslerinin Almanca telaffuz kalitesi (dinlenmedi).

10 dakikalık sabah kontrolü: `pnpm dev:link`, linki kendi Chrome'unda aç, kamerayı ve
tüm ekranı paylaş, tam ekrana geç, bir bölüm çöz, bir sekme değiştir, telefonu kameraya
göster; sonra panelde öğrencinin Bütünlük sekmesine bak.

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
