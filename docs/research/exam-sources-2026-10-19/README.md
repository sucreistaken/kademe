# Gerçek sınav kaynaklarından soru havuzu dersleri (2026-10-19)

Amaç: ÖSD, telc ve TestDaF'ın gerçek model sınavlarını ve hazırlık kitaplarını okuyup Kademe başlangıç
bankasının (`src/db/seed-bank/levels/*.ts`) nerede zayıf olduğunu ve nasıl düzeltileceğini çıkarmak.
Bu dosya özet ve iş listesidir; seviye başına ayrıntılı raporlar aynı klasörde (İngilizce).

**Telif ve ürün kuralı.** Kaynaklar yalnızca format, görev tipi ve madde yazım kalıbı için okundu.
Hiçbir metin, madde ya da görev cümlesi bankaya kopyalanmaz (ürün kuralı: sınav içeriği özgündür).
Raporlardaki bütün örnekler özgün yazımdır. Kaynak dosyalar repo dışında durur ve commit edilmez.

## Kaynaklar

Yer: `~/Desktop/Projects/kademe-kaynaklar/` (`originals/` asıl dosyalar, `text/` çıkarılmış metin).
Gelen yol: Telegram, 2026-10-18 paylaşılan dosyalar.

| Sınav | Kaynak | Okundu mu |
|---|---|---|
| ÖSD A1, A2, B1, B2, C1, C2 | Resmi Modellsätze (6 PDF) | evet, metin |
| telc B1 | Prüfungstraining Zertifikat Deutsch B1 (Cornelsen, 4 deneme + çözümler) | evet, OCR |
| telc B2 | Übungstest 1, B2 Beruf Übungstest, ZDfB Modelltest, Tipps-Heft, Mit Erfolg Modelltest 1-3, Mit Erfolg zu telc B2 | evet (Mit Erfolg kısmen bozuk OCR) |
| telc B2-C1 Medizin | Übungstest 1 | göz atıldı |
| ÖSD B2 | Das Testbuch ÖSD B2 | yalnız yapı (OCR çoğunlukla bozuk) |
| TestDaF | Musterprüfung 5, Prüfungstraining TestDaF, Mit Erfolg zum TestDaF | evet |
| DTZ A2-B1 | Mit Erfolg zum DTZ, yalnız dinleme transkriptleri | evet |
| Okunamayanlar | DTZ kitabı, Fit für den TestDaF, Mit Erfolg telc B2 Übungsbuch, TestDaF Musterprüfung 1-4 (taranmış, metin yok); ses CD'leri | hayır |

## Doğrulanmış bulgular (bütün seviyeler)

Her madde ya bir betikle sayıldı ya da satırı okunarak kontrol edildi.

1. **Doğru şık çoğu zaman en uzun şık.** Şıklar sunumda karıştırılıyor (`src/lib/exam/safe.ts:168`) ama
   uzunluk ipucu karıştırmayla kaybolmaz. Benzersiz en uzun şıkkın doğru olduğu madde sayısı
   (şansla beklenen yaklaşık 1/4):

   | Bölüm | B1 | B2 | C1 | C2 |
   |---|---|---|---|---|
   | Okuma | 5/10 | 7/9 | 7/10 | 3/10 |
   | Dinleme | 5/9 | 6/9 | 4/10 | 4/10 |
   | Dilbilgisi | 2/18 | 5/18 | 5/15 | 3/15 |

   A1 ve A2 temiz (0-2). Sorun B1-C1 okuma ve dinlemede.

2. **R/F/NG kalıbı tahmin edilebilir.** Her R/F/NG setinde tam bir "nicht im Text" var ve neredeyse hep sonda
   (B1'de 7/7, B2+C1'de 11/12). İfadeler metni izlediği için sunumda karıştırılmıyor (`safe.ts:253`),
   yani öğrenci bu kalıbı görür. Ek olarak:
   - ÖSD ve telc A1-B2 sınavlarında NG yok, yalnız Richtig/Falsch. NG TestDaF'ta (B2-C1) var.
     A1'de istemde NG seçeneği sunuluyor ama hiçbir anahtar NG değil (`a1.ts:330`, `a1.ts:550`).
   - Bazı NG ifadeleri metnin konusuna değil konuşmacının özel hayatına dayanıyor (`b2.ts:777`, `c1.ts:630`).
   - Bazı NG/F ayrımları tartışmalı (`b2.ts:604`, `c1.ts:522`, `c1.ts:556`).

3. **Boşluklu metinler gerçek sınavdan çok farklı.**
   - Yoğunluk: bizde yaklaşık 12 kelimede bir boşluk, telc'te 25-30 kelimede bir.
   - Çeldirici türü: telc'te her boşluğun şıkları aynı ailedendir (hâl ekleri, aynı kökten fiiller, zamir dizisi).
     Bizde birçok çeldirici yalnız özne-yüklem uyumuyla ya da var olmayan bir biçimle eleniyor.
     Örnekler: "gestiegt" `b2.ts:323`, "gelohnen" `b2.ts:314`, "fahrte/fährte" `b1.ts:112`, "gebezahlt" `b1.ts:150`.
   - Kelime havuzu: telc havuzu edat, bağlaç, da-bileşikleri ve modal fiil karışımıdır. Bizimkiler yalnız
     içerik kelimesi ve çeldiricileri konu ya da tür bakımından alakasız (`b1.ts:334/349/364`).

4. **Konu tek tip.** Okuma ve dinleme metinlerinin, yazma ve konuşma istemlerinin büyük çoğunluğu iş ya da
   eğitim konulu. C1-C2'de 14 metnin 13'ü öyle. Gerçek sınavlar sağlık, medya, çevre, konut, aile, spor
   ve bilim gibi konulara yayılıyor. Sonuç: alt puan kısmen iş kelime hazinesini ölçüyor.

5. **Az metin, metin başına çok soru.** Her seviyede 4 okuma metni ve 3 dinleme kaydı var, her birinden 4 soru.
   Sınavlarda 10'dan fazla metin ve kayıt var. Bir metni anlamayan öğrenci 4 soruyu birden kaybediyor.

6. **Dinleme metinleri yazı gibi okunuyor.** Konuşma diline özgü düzeltme, tekrar, "also / ach so" gibi
   dolgu sözcükleri yok. C1 dersi ve C2 haber metni düzgün yazılı nesir. İyi örnek: A2 telesekreter kaydı
   numarayı tekrarlıyor, B2 randevu kaydında gün değişiyor.

7. **Seviye kayması.** Örnekler:
   - B2 "EASY" maddelerin bir kısmı B1 içeriği: `b2.ts:108`, `b2.ts:135-136`.
   - C1/C2'de B2 maddeleri var: `c1.ts:117`, `c2.ts:90`, `c2.ts:115`.
   - B1 HARD maddelerin bir kısmı A2 seviyesinde: `b1.ts:201`, `b1.ts:205`.

8. **Eksik görev tipleri.**
   - Hepsi var olan madde tipleriyle kurulabilir: not alarak dinleme (GAP_FILL/SHORT_TEXT), başlık eşleme,
     "hiçbiri uymaz" seçenekli ilan eşleme, tek kelimelik açık boşluk metni, hata düzeltme metni,
     çok seçimli dinleme (MULTI_CHOICE).
   - Yazmada, sorularını yanıtlamak gereken gelen bir e-posta ya da ilan veren istem yok.
   - Tablo verip yorumlatan istem ve "Ihrem Land" karşılaştırma maddesi hiç yok.

## Düşürülen ya da yumuşatılan bulgular

- "Doğru şık hiç d değil": doğru, ama şıklar sunumda karıştırılıyor, öğrenci görmüyor. Yalnız veri düzeni meselesi.
- "acht halb bariz yanlış" (`a1.ts:185`): bilinçli bir Türkçe aktarım hatası, iyi bir çeldirici. Kalsın.
- "Himmeln" (`c2.ts:165`): var olan bir biçim, düşük öncelik.
- "zur Verfügung geben" (`b2.ts:127`): standart değil, anahtar doğru.

## Motor gerçekleri (kodda kontrol edildi)

- `SHORT_TEXT` anahtarı kabul edilen yanıt listesi tutuyor ve otomatik puanlanıyor (`item-scoring.ts:95`).
  Not alma maddeleri için hazır.
- Dinleme dinleme hakkı sınav ayarında 1-3 arası, varsayılan 2 (`blueprint.ts:108`).
- Aday ekranı maddeyi bölüme göre değil tipe göre çiziyor (`ItemView.tsx`). Bu yüzden dinleme metnine bağlı
  GAP_FILL ve SHORT_TEXT kodda engelli görünmüyor. Chrome'da canlı denenmedi.
- İstemlerde resim desteği yok, fotoğraf görevleri metinle betimlenmeli. Düz metin tablonun nasıl
  göründüğü denenmedi.

## İş listesi (öncelik sırasıyla)

**P0, bütünlük ve hijyen (yaklaşık yarım gün, yalnız seed verisi ve bir test):**
1. R/F/NG düzeni: NG sayısı 0-2, yeri değişken.
   - A1-B1'de istem yalnız Richtig/Falsch olsun; NG B2 ve üstü için.
   - Konuşmacının özel hayatına dayanan NG ifadelerini kaldır.
   - NG için Klett kuralını uygula: konu metinde geçer ama istenen ayrıntı hiç verilmez.
2. Şık uzunluğu: B1-C1 okuma ve dinlemede doğru şıkkın en uzun olduğu oran yaklaşık %30'un altına insin.
   `bank-seed.test.ts`'e bunu ve NG konumunu denetleyen bir test ekle.
3. Var olmayan biçim ve salt uyum çeldiricilerini aynı aileden gerçek biçimlerle değiştir.
4. Tartışmalı anahtarları düzelt: `b2.ts:170` (anstatt), `b2.ts:604`, `c1.ts:522`, `c2.ts:99`.

**P1, yeni görev tipleri (seviye başına yaklaşık 1 gün):**
5. Not alarak dinleme: telesekreter ya da ders, SHORT_TEXT veya GAP_FILL, kabul listeli.
6. Kısa duyuru dinleme kayıtları: 40-90 kelime, kayıt başına 1-2 soru. Konuşma dili özellikleri ekle:
   düzeltme, tekrarlanan sayı, dolgu sözcükleri.
7. Başlık eşleme (A2+) ve "hiçbiri uymaz" seçenekli durum-ilan eşleme (A1-B2).
8. telc tarzı boşluk metinleri:
   - 200-250 kelimelik mektup, 10 boşluk, aynı aileden şıklar.
   - İşlev kelimesi havuzu: 15 kelime, 10 boşluk.
   - C1-C2 için tek kelimelik açık boşluk metni.
9. Yazma: gelen e-postayı ya da ilanı istemin içinde ver, soruları yanıtlat (A1 3 soru ve yaklaşık 30 kelime,
   A2 5 soru ve yaklaşık 50 kelime). B2 ve üstüne şikâyet mektubu ve "kendi ülkenizde" maddesi ekle.
   C1'e tablo yorumlama ekle.

**P2, içerik genişletme:**
10. Her seviyede metinlerin en az yarısı iş dışı konudan olsun. Her metne en fazla 2 soru bağla, metin sayısını artır.
11. Dinleme metinlerini konuşma diline göre yeniden yaz. C1 metinlerini 550-650 kelimeye uzat.
12. Seviye kaymış maddeleri doğru seviyeye taşı.

## Karar bekleyenler

- **Var olmayan biçimler.** "fahrte" gibi aşırı genelleme biçimleri çeldirici olarak kalsın mı?
  telc ve ÖSD hiç kullanmıyor. Bir yerleştirme sınavında öğrenci hatasını yakalamak için savunulabilir.
  Öneri: tek cümlelik A1-A2 maddelerinde kalsın, boşluklu metinlerde kalksın.
- **Konu dengesi.** Banka işe alımda da kullanıldığı için iş konuları bilinçli mi? Öneri: seviye sınavı için
  karışık konu, iş alıştırmaları için ayrı iş paketi.
- **Yaş konusu.** A1 başlığı yaşı bilerek dışarıda bırakıyor (`a1.ts:30`). A2 röportajı ise yaş üzerine
  kurulu (`a2.ts:780`). Hangisi geçerli?
