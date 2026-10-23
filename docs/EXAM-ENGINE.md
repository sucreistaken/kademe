# Sınav motoru

Kademe'nin seviye ölçümü nasıl çalışır, hangi seçimler yapıldı, sınırları nerede.
Kod: `src/lib/exam/` (saf, veritabanısız, vitest ile test edilir).

## Model

- **Rasch (1PL) + EAP.** Her sorunun tek parametresi var: zorluk `b` (logit). Öğrencinin
  yeteneği `theta`. Doğru cevap olasılığı `1 / (1 + e^-(theta - b))`.
  EAP tahmini -4..4 arasında 81 noktalı ızgarada hesaplanır (`adaptive.ts: eap`).
  Neden: banka küçük ve kalibre edilmemiş; daha çok parametreli bir model gürültüye uyar.
  EAP, hepsi doğru cevaplarda sonsuza kaçmaz.
- **CEFR bantları** (`cefr.ts`): her seviye 1 logit genişliğinde. Merkezler A1 -2.5,
  A2 -1.5, B1 -0.5, B2 0.5, C1 1.5, C2 2.5; kesim noktaları -2, -1, 0, 1, 2.
  **Bu bir kalibrasyon değil, bir sözleşmedir.** Gerçek öğrenci verisiyle hiç ayarlanmadı.
- **Soru zorluğu** seviyesinden gelir: `thetaForLevel(level, EASY|MID|HARD)`, bant
  merkezinin ±0.3'ü.
- **Kısmi puan** (3 boşluktan 2'si doğru) kesirli Bernoulli olarak girer. Gerçek bir
  kısmi puan modeli değil ama tahmini doğru yöne doğru miktarda iter.
- **C-test ağırlığı (2026-10-15).** Bir C-test metni, tek bir süper madde olarak girer:
  ağırlığı `max(1, boşluk / 4)` (`C_TEST_GAPS_PER_WEIGHT = 4`; `adaptive.ts: itemWeight`,
  `observationOf`, `replayResponseOf`). 20 boşluklu bir metin 5 ağırlığındadır. Neden: aynı
  metindeki boşluklar bağımsız değil (aynı okuma, aynı bağlam); her boşluğu ayrı madde
  saymak tahmini olduğundan kesin gösterirdi, tek madde saymak ise 20 boşluklu metni 1
  soruluk ağırlığa indirirdi. `4` bir kalibrasyon değil, gerçek veriyle hiç ayarlanmadı.
  Gerçek veri birikince yerini bir kısmi puan modeli (boşluk başına kategori) almalı.
  Ağırlık yalnız `cTestLevels` ya da `texts` olan bölümde uygulanır (`blueprint.ts: weighsTexts`);
  eski `cTest: true` bölümü ağırlık 1 kalır. Neden: 2026-10-15 öncesi sınavların kayıtlı tahminleri
  ağırlık 1 ile hesaplandı; bir öğretmen tek boşluğu kabul edip `reestimateRun` çalışınca sonuç
  başka bir sebeple kaymamalı. 2026-10-18'den beri aynı ağırlık çoktan seçmeli boşluklu metne
  (11 boşluk: 2.75) ve kelime havuzuna (8 boşluk: 2) da uygulanır.
- **Tahmin tabanı (2026-10-18).** Seçenekli boşluk tahminle de doğru olabilir. Boşluklu metin
  ve kelime havuzu için doğru olasılığı `p = c + (1 - c) * sigma(theta - b)` (`adaptive.ts:
  pWithGuess`, `guessOf`): çoktan seçmeli boşlukta `c = 1/4`, kelime havuzunda `c = 1 / havuzdaki
  kelime sayısı` (bankada 12-13), diğer her madde türünde `c = 0`. `c = 0` iken formül tam olarak
  eski `pCorrect`; eski denemeler bit bit aynı yeniden tahmin edilir. Sıradan çoktan seçmeli
  maddelere (dilbilgisi, okuma, dinleme) taban verilmez: tahmin onlarda düzeltilmez (aşağıdaki
  simülasyon bunun bedelini gösterir).
- **Testlet bağımlılığı** (aynı metne bağlı sorular) yok sayılır; bu, okuma/dinleme
  hassasiyetini olduğundan biraz iyi gösterir.

## Uyarlanabilir seçim

`selectNext`: tahmine en yakın zorluktaki ilk 3 aday arasından rastgele (maruz kalma
kontrolü), sık görülen beceri etiketine küçük ceza. Okuma ve dinlemede birim, metin ya da
kayıttır: bütün soruları sırayla sunulur. Durma: `maxItems`, ya da `minItems` sonrası
`sd <= targetSe`, ya da havuz biter. Durum her istekte kayıtlı cevaplardan yeniden
kurulur (`replay`), istemciye hiç güvenilmez.

Doğrulama sınavında başlangıç tahmini beyan seviyesinin merkezi, seviye tespitinde B1;
ikisinde de sd 1.5 (birkaç cevap önseli aşar).

## Ölçülen doğruluk (simülasyon)

Başlangıç bankası üzerinde, bilinen seviyedeki sanal öğrenciler, her hücre 200 koşu
(2026-09-30). "tam / ±1 seviye (ortalama soru)":

| Bölüm | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| Dilbilgisi (10-18 soru) | 72/100 | 71/100 | 77/100 | 74/100 | 67/100 | 62/99 |
| Okuma (6-12, testlet) | 62/99 | 60/100 | 69/100 | 66/100 | 63/100 | 59/99 |
| Dinleme (6-9, testlet) | 56/95 | 56/99 | 62/99 | 56/99 | 52/97 | 42/90 |

Tek bir beceri tek başına ~%60-75 tam isabet verir; genel seviye birkaç becerinin alt
medyanı olduğu için daha kararlıdır. Dinleme varsayılanı bu yüzden 12 soruya çıkarıldı.
25 soruluk dilbilgisi bölümü %73-82 tam isabete çıkar.

## Sabit form

Uyarlanabilir kapalıysa `sampleFixedForm` seviye başına istenen sayıda soru çeker
(okuma/dinlemede bütün metinler), kolaydan zora sıralar. Doğrulamada dağılım beyana
göredir (bir alt / beyan / bir üst). Ulaşılmayan planlı sorular 0 puan alır: erken
bitirmek cevaplamaktan kârlı olamaz.

**Gezinme (2026-10-14).** Sabit formlu bir bölüm (planı olan objektif bölüm ve yazma;
konuşma hariç) başlarken `navigable` işaretlenir ve bütün planı tek seferde sunar.
Öğrenci her soruya gidebilir, cevabını değiştirebilir (taslak olarak saklanır) ve soruyu
işaretleyebilir; imleç ve işaretler sunucuda durur. Bölüm yalnızca gözden geçirme
adımından ya da süre dolunca kapanır; o an kaydedilmiş bütün taslaklar puanlanır ve
öğretmenin gidişat grafiği sıra düzeninde yeniden çizilir. Uyarlanabilir bölümler ve
konuşma tek yönlü kalır. Kurallar `src/lib/exam/navigation.ts` içinde, veritabanısız
test edilir.

**C-test düzeni (2026-10-15).** Bir DILBILGISI bölümü `cTestLevels` alabilir (ör.
`["A1","A2","B1","B2","C1","C2"]`): bölüm, listelenen her seviyeden bankadan bir C-test ile
açılır, kolaydan zora. Bankada o seviyede C-test yoksa seviye atlanır. Eski `cTest: true`
hâlâ çalışır ve çapa seviyede tek C-test demektir (`blueprint.ts: cTestLevelsOf`,
`textOpenings`, `isTextOnly`).

**Boşluklu metin ve kelime havuzu (2026-10-18).** Spec
`docs/superpowers/specs/2026-10-18-grammar-cloze-wordbank-design.md`. Bir DILBILGISI bölümü
`texts` alabilir: `{ level, kind: "CLOZE" | "WORDBANK" }` listesi. Varsa `cTestLevels` ve
`cTest` yerine geçer (`blueprint.ts: textPlanOf`). Bölüm önce boşluklu metinlerle, sonra kelime
havuzlarıyla açılır, her tür kolaydan zora. Puanlama boşluk başına değişmedi (doğru boşlukların
oranı). Eski sınavlar kayıtlı yapılandırmasını (ve davet edilmiş öğrenci `blueprint_snapshot`'ını)
korur; C-testler bankada ACTIVE kalır.

Hazır şablonlar sabit formdur (2026-10-18). Yerleştirme: DILBILGISI = A1'den C2'ye altı
çoktan seçmeli boşluklu metin ve A2, B1, B2 kelime havuzu, 30 dk; A2-C1 okuma ve A2-B2 dinleme
(seviye başına bir metin ya da kayıt); toplam 77 dk. Hızlı seviye taraması: A1-B2 dört boşluklu
metin ve A1-B1 üç kelime havuzu, 25 dk (spec'in başlangıcı 15 dk idi, kapıdan geçmedi; aşağıda).
Okuma süresi varsayımı: boşluklu metin yaklaşık 3.5 dk, kelime havuzu 3 dk, beşe yuvarlanır.
AI oluşturucu şablonu süre oranıyla seçer (`exam-config.ts: examTemplateFor`): süre uyumu puanı
`30 * |log2(şablon dakikası / hedef)|`. Hızlı tarama bu karşılaştırmada hâlâ 15 dakika sayılır
(`MATCH_MINUTES`), bu yüzden beceri söylenmediğinde hızlı tarama ile yerleştirme (77) arasındaki
sınır eskisi gibi yaklaşık 34 dakikadır: 40 dakikalık istek dört becerili yerleştirme biçimini
alır (son inceleme kararı, 2026-10-18). Yeniden ölçeklemede (`exam-config.ts: textsFor`) süre
artınca her tür kendi sayısını süre oranıyla `round` eder ve aralığı önce yukarı sonra aşağı
genişletir. Süre azalınca bölüm `round(metin * oran)` metin tutar (en az bir): önce kelime
havuzları, sonra en düşük boşluklu metinler düşer; B2 ve B1 en son gider ve aralığın tepesi
önce kesilmez (hızlı tarama 20 dk: A1-B2 boşluklu metin + A2, B1 kelime havuzu; 15 dk: A1-B2
boşluklu metin; 10 dk: A2-B2). Yeniden ölçeklenmiş formlar simüle edilmedi, yalnız şablonların
kendisi. Eski `cTestLevels` bölümü hâlâ `floor(dakika / 5)`
metin tutar (`cTestLevelsFor`).

Simülasyon ve kapı (`scripts/simulate-placement.ts`, 2026-10-18; seviye başına 4000 sanal
öğrenci, bant içinde düzgün; birleşik objektif seviye). Cevaplar tahminle üretilir: her sıradan
çoktan seçmeli madde (dilbilgisi, okuma, dinleme) `c = 0.25`, boşluklu metin boşluğu 0.25,
kelime havuzu boşluğu `1 / (8 + 4)` (bankadaki 13'lük havuzdan biraz cömert), C-test 0; bir
metnin boşlukları sd 0.5 rastgele metin etkisini paylaşır. Motor sıradan maddelere taban vermez,
boşluklu metin ve kelime havuzuna verir; "tahminde taban yok" satırları tabanı yalnız tahminden
çıkarır (düzeltmenin etkisi). (a) onSET öncesi çoktan seçmeli form (`3c4fd3c^`: yerleştirmede
seviye başına 3 madde + açılışta tek B1 C-test, ağırlık 1; hızlı taramada seviye başına 4 madde),
(b) bugünkü C-test formu, (c) boşluklu metin bileşimleri. Kapı, A1-C1: (c) tam isabet >= (a) - 2
puan ve ±1 >= (a) - 1 puan; A1'de üst yerleştirme <= (b) + 5 puan (`form-simulation.ts:
gateFailures`). Bir bileşim iki tohumda da (2026 ve 7) geçmeli; geçenlerin en kısası seçilir.
Hücreler "tam / ±1 / üste yerleştirme", %, tohum 2026.

Yerleştirme:

| Form | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| (a) çoktan seçmeli, onSET öncesi | 0.3 / 40.8 / 99.8 | 6.7 / 89.5 / 93.3 | 31.9 / 98.5 / 68.0 | 63.3 / 99.9 / 35.9 | 83.0 / 100.0 / 10.2 | 62.8 / 100.0 / 0.0 |
| (b) C-test, bugünkü | 6.4 / 93.1 / 93.6 | 34.9 / 99.8 / 65.0 | 66.2 / 100.0 / 33.2 | 84.3 / 100.0 / 12.4 | 84.1 / 100.0 / 3.0 | 58.6 / 100.0 / 0.0 |
| (c) 6 boşluklu metin A1-C2 + 3 kelime havuzu A2-B2, 30 dk | 2.4 / 76.4 / 97.6 | 23.4 / 98.5 / 76.6 | 57.7 / 100.0 / 41.9 | 80.0 / 100.0 / 16.7 | 82.8 / 100.0 / 2.0 | 43.8 / 99.9 / 0.0 |
| (c) aynı, tahminde taban yok | 0.0 / 50.8 / 100.0 | 6.5 / 95.4 / 93.5 | 34.9 / 99.6 / 65.1 | 67.4 / 100.0 / 32.0 | 88.8 / 100.0 / 6.4 | 67.2 / 100.0 / 0.0 |
| (c) aynı, metin başına 14 boşluk (varsayım), 40 dk | 2.8 / 79.7 / 97.2 | 24.0 / 99.0 / 75.9 | 61.0 / 100.0 / 38.6 | 82.0 / 100.0 / 14.9 | 83.2 / 100.0 / 2.3 | 46.7 / 99.9 / 0.0 |
| (c) aynı, tahminde taban yok | 0.2 / 50.8 / 99.8 | 4.8 / 94.4 / 95.2 | 33.6 / 99.6 / 66.4 | 65.9 / 100.0 / 34.0 | 87.4 / 100.0 / 8.6 | 72.3 / 100.0 / 0.0 |
| (c) 6 boşluklu metin + 4 kelime havuzu A2-C1, 35 dk | 2.1 / 77.4 / 97.9 | 21.9 / 98.7 / 78.0 | 59.2 / 100.0 / 40.3 | 82.1 / 100.0 / 14.9 | 82.8 / 100.0 / 2.3 | 46.8 / 99.9 / 0.0 |
| (c) aynı, tahminde taban yok | 0.0 / 52.5 / 100.0 | 6.2 / 95.1 / 93.8 | 35.8 / 99.7 / 64.2 | 68.9 / 100.0 / 30.6 | 87.7 / 100.0 / 7.4 | 70.0 / 100.0 / 0.0 |

Hızlı tarama:

| Form | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| (a) çoktan seçmeli, onSET öncesi | 2.5 / 41.3 / 97.5 | 11.6 / 70.5 / 88.2 | 28.0 / 87.4 / 70.8 | 44.6 / 93.3 / 51.8 | 52.6 / 99.9 / 37.5 | 82.8 / 99.7 / 0.0 |
| (b) C-test, bugünkü | 64.8 / 99.7 / 35.1 | 75.3 / 100.0 / 17.5 | 69.8 / 100.0 / 15.2 | 75.6 / 99.9 / 7.2 | 60.4 / 100.0 / 2.1 | 27.6 / 98.0 / 0.0 |
| (c) 3 boşluklu metin A2-B2 + kelime havuzu B1, 15 dk | 33.9 / 99.0 / 66.1 | 73.0 / 99.9 / 22.2 | 70.2 / 99.8 / 11.2 | 65.1 / 99.7 / 5.8 | 46.9 / 98.9 / 0.0 | 0.0 / 91.3 / 0.0 |
| (c) aynı, tahminde taban yok | 1.1 / 70.4 / 99.0 | 21.4 / 95.7 / 78.5 | 53.4 / 99.4 / 46.0 | 76.4 / 100.0 / 18.7 | 76.4 / 100.0 / 0.0 | 0.0 / 98.8 / 0.0 |
| (c) aynı, metin başına 14 boşluk (varsayım), 20 dk | 42.8 / 99.3 / 57.2 | 73.0 / 99.9 / 20.9 | 72.2 / 99.9 / 10.8 | 68.6 / 99.8 / 4.8 | 47.9 / 99.1 / 0.0 | 0.0 / 93.5 / 0.0 |
| (c) aynı, tahminde taban yok | 0.6 / 65.5 / 99.4 | 16.4 / 97.7 / 83.6 | 56.6 / 99.6 / 43.0 | 73.5 / 100.0 / 21.9 | 80.5 / 100.0 / 0.7 | 10.0 / 99.6 / 0.0 |
| (c) 4 boşluklu metin A1-B2 + kelime havuzu B1, 20 dk | 51.4 / 99.4 / 48.6 | 71.8 / 99.8 / 22.5 | 73.0 / 99.9 / 11.5 | 68.7 / 99.8 / 4.5 | 46.7 / 99.4 / 0.0 | 0.0 / 90.4 / 0.0 |
| (c) aynı, tahminde taban yok | 3.3 / 83.5 / 96.7 | 25.4 / 97.1 / 74.5 | 53.9 / 99.6 / 45.2 | 79.5 / 100.0 / 16.3 | 72.9 / 100.0 / 1.8 | 14.3 / 98.3 / 0.0 |
| (c) 3 boşluklu metin A2-B2 + kelime havuzu A2, B1, 20 dk | 49.8 / 99.6 / 50.2 | 72.6 / 99.9 / 21.3 | 72.9 / 100.0 / 11.6 | 71.2 / 99.8 / 3.9 | 44.2 / 99.5 / 0.0 | 0.0 / 90.8 / 0.0 |
| (c) aynı, tahminde taban yok | 2.1 / 86.3 / 97.9 | 29.1 / 98.9 / 70.8 | 61.8 / 99.6 / 37.3 | 73.4 / 100.0 / 20.9 | 79.8 / 100.0 / 1.1 | 13.6 / 99.4 / 0.0 |
| (c) 3 boşluklu metin A2-B2 + kelime havuzu A1-B1, 20 dk | 58.9 / 99.8 / 41.1 | 73.0 / 100.0 / 20.7 | 74.2 / 100.0 / 12.4 | 70.0 / 99.9 / 5.3 | 50.8 / 99.7 / 0.0 | 0.0 / 94.1 / 0.0 |
| (c) aynı, tahminde taban yok | 7.0 / 90.1 / 93.0 | 31.4 / 99.1 / 68.5 | 60.4 / 99.6 / 39.1 | 76.2 / 100.0 / 18.5 | 78.1 / 100.0 / 1.1 | 12.3 / 99.4 / 0.0 |
| (c) 3 boşluklu metin A2-B2 + kelime havuzu A2-B2, 20 dk | 53.1 / 99.7 / 46.9 | 74.5 / 99.9 / 19.0 | 74.0 / 100.0 / 11.3 | 71.0 / 100.0 / 4.8 | 54.9 / 99.8 / 0.2 | 6.4 / 97.1 / 0.0 |
| (c) aynı, tahminde taban yok | 3.0 / 84.0 / 97.0 | 25.8 / 99.3 / 74.1 | 62.6 / 99.6 / 37.0 | 75.8 / 100.0 / 18.9 | 83.8 / 100.0 / 1.1 | 20.5 / 99.8 / 0.0 |
| (c) 4 boşluklu metin A1-B2 + kelime havuzu A1, A2, 20 dk | 61.1 / 99.8 / 38.9 | 71.7 / 99.9 / 21.8 | 74.7 / 100.0 / 11.9 | 69.7 / 99.9 / 3.7 | 41.5 / 99.3 / 0.0 | 0.0 / 87.7 / 0.0 |
| (c) aynı, tahminde taban yok | 8.0 / 91.7 / 92.0 | 32.5 / 98.3 / 67.5 | 57.3 / 99.5 / 41.8 | 74.8 / 100.0 / 20.5 | 79.7 / 100.0 / 0.0 | 0.0 / 99.2 / 0.0 |
| (c) 4 boşluklu metin A1-B2 + kelime havuzu A1, B2, 20 dk | 55.4 / 99.6 / 44.6 | 72.6 / 100.0 / 21.9 | 74.5 / 99.9 / 11.1 | 68.0 / 99.9 / 4.3 | 51.0 / 99.3 / 0.0 | 0.0 / 94.0 / 0.0 |
| (c) aynı, tahminde taban yok | 5.5 / 87.8 / 94.5 | 29.3 / 98.3 / 70.7 | 59.2 / 99.8 / 40.1 | 77.2 / 100.0 / 17.7 | 75.7 / 100.0 / 2.5 | 26.2 / 99.5 / 0.0 |
| (c) 4 boşluklu metin A2-C1 + kelime havuzu A1, A2, 20 dk | 53.3 / 99.3 / 46.7 | 72.0 / 99.9 / 21.7 | 73.8 / 100.0 / 11.2 | 67.7 / 99.8 / 3.7 | 47.1 / 99.2 / 0.4 | 10.5 / 94.3 / 0.0 |
| (c) aynı, tahminde taban yok | 1.9 / 71.0 / 98.1 | 15.5 / 94.0 / 84.4 | 41.2 / 99.1 / 58.6 | 70.2 / 99.9 / 28.0 | 83.7 / 100.0 / 4.2 | 40.0 / 99.9 / 0.0 |
| (c) 4 boşluklu metin A2-C1 + kelime havuzu A1, B1, 20 dk | 48.9 / 99.3 / 51.0 | 73.5 / 100.0 / 20.8 | 74.1 / 100.0 / 10.4 | 67.5 / 99.8 / 4.1 | 50.0 / 99.4 / 0.3 | 8.8 / 95.6 / 0.0 |
| (c) aynı, tahminde taban yok | 0.8 / 63.2 / 99.2 | 12.9 / 95.8 / 87.1 | 46.9 / 99.0 / 52.9 | 69.8 / 99.9 / 27.8 | 82.4 / 100.0 / 6.9 | 53.5 / 99.9 / 0.0 |
| (c) 4 boşluklu metin A1, B1-C1 + kelime havuzu A1, A2, 20 dk | 53.7 / 99.4 / 46.3 | 70.8 / 99.9 / 23.5 | 74.9 / 100.0 / 11.3 | 66.3 / 99.8 / 3.5 | 43.8 / 98.9 / 0.1 | 2.8 / 93.0 / 0.0 |
| (c) aynı, tahminde taban yok | 2.4 / 72.0 / 97.6 | 16.3 / 92.3 / 83.7 | 38.9 / 99.2 / 60.8 | 74.1 / 99.9 / 23.8 | 79.6 / 100.0 / 4.8 | 41.8 / 99.7 / 0.0 |
| (c) 3 boşluklu metin A2-B2 + kelime havuzu A1, B1, B2, 20 dk | 51.8 / 99.8 / 48.2 | 74.0 / 100.0 / 19.9 | 73.6 / 100.0 / 11.1 | 69.6 / 99.9 / 5.7 | 56.7 / 99.8 / 0.2 | 6.8 / 97.5 / 0.0 |
| (c) aynı, tahminde taban yok | 2.6 / 86.4 / 97.4 | 28.5 / 99.1 / 71.5 | 62.0 / 99.8 / 37.4 | 78.1 / 100.0 / 16.1 | 77.7 / 100.0 / 1.3 | 21.6 / 99.7 / 0.0 |
| (c) 3 boşluklu metin A2-B2 + kelime havuzu A1, A2, B2, 20 dk | 55.6 / 99.7 / 44.4 | 73.0 / 100.0 / 20.6 | 74.7 / 100.0 / 11.5 | 69.6 / 99.9 / 5.1 | 52.2 / 99.7 / 0.0 | 0.0 / 95.5 / 0.0 |
| (c) aynı, tahminde taban yok | 5.5 / 89.4 / 94.5 | 31.6 / 98.8 / 68.3 | 57.8 / 99.7 / 41.6 | 80.5 / 100.0 / 15.1 | 74.1 / 100.0 / 2.2 | 25.1 / 99.5 / 0.0 |
| (c) 4 boşluklu metin A1-B2 + kelime havuzu A1-B1, 25 dk | 65.7 / 99.9 / 34.3 | 74.0 / 99.9 / 19.4 | 75.3 / 100.0 / 12.1 | 71.0 / 100.0 / 5.7 | 53.4 / 99.8 / 0.0 | 0.0 / 95.0 / 0.0 |
| (c) aynı, tahminde taban yok | 7.2 / 94.5 / 92.8 | 35.3 / 99.1 / 64.7 | 60.9 / 99.8 / 38.6 | 79.6 / 100.0 / 15.7 | 76.5 / 100.0 / 1.0 | 11.8 / 99.5 / 0.0 |
| (c) 5 boşluklu metin A1-C1 + kelime havuzu A1-B1, 30 dk | 66.6 / 99.9 / 33.4 | 74.3 / 100.0 / 19.1 | 78.1 / 99.9 / 9.5 | 72.8 / 100.0 / 4.4 | 54.2 / 99.7 / 0.5 | 13.9 / 97.5 / 0.0 |
| (c) aynı, tahminde taban yok | 3.7 / 88.3 / 96.3 | 21.8 / 97.9 / 78.2 | 48.7 / 99.7 / 51.0 | 70.9 / 99.9 / 27.7 | 84.5 / 100.0 / 5.5 | 49.8 / 100.0 / 0.0 |

Kapı sonucu: yerleştirmede spec'in başlangıcı (6 boşluklu metin + 3 kelime
havuzu, 30 dk) iki tohumda geçti, seçildi. Hızlı taramada 15 dakikalık başlangıç geçmedi (A1'in %66'sı üste,
(b)'de %35; C1 tam %47, sınır %51); 20 dakikalık on iki bileşimden (biri 14 boşluk varsayımı) hiçbiri iki tohumda geçmedi
("3 boşluklu metin A2-B2 + kelime havuzu A1-B1" tohum 7'de geçti, 2026'da A1 üst 41.1 > 40.1);
ilk geçen 25 dakikalık "4 boşluklu metin A1-B2 + kelime havuzu A1-B1" seçildi. Metin başına 14
boşluk satırları varsayımdır: bankada 11 boşluklu metinler var. İkinci bir B1 boşluklu metni
`texts` ile ifade edilemez (tür ve seviye başına bir metin), denenmedi.

Notlar:
- Yerleştirmede A1 ve A2 tam isabetinin düşük olması (a, b ve c'de) okuma ve dinleme maddelerinde
  tahmin yüzündendir: motor onlara taban vermez, şanslı tahmin öğrenciyi yukarı iter. Bu,
  C-test formunda da vardı; tahminsiz eski simülasyon (A1 %70) bunu göstermiyordu.
- Duyarlılık (`ITEM_GUESS=0`, sıradan maddeler tahminsiz, metin tahmini aynı): yerleştirmede
  seçilen form kapıyı az farkla geçemez (A1 üst %35.1 > %34.6 ve tohum 7'de %35.2 > %34.3; tohum
  7'de C1 tam %66.3 < %66.5); yalnız 14 boşluk varsayımı (40 dk) iki tohumda geçer. Hızlı taramada
  25 dk tohum 7'de C1 tam %52.4 < %53.4 ile kalır; 30 dk "5 boşluklu metin A1-C1 + kelime havuzu
  A1-B1" iki tohumda geçer. Kapı spec'teki gibi tahminli cevaplarla uygulandı.
- Tabanın etkisi: tabansız tahminde hızlı taramanın 15 dakikalık formu A1 öğrencisini %99
  üste koyuyor, tabanla %66; yerleştirmede A1 ±1 %51'den %76'ya çıkıyor.
- C2: yerleştirmede tam isabet %59'dan (b) %44'e düştü; hızlı taramada en zor metin B2 olduğu
  için C2 öğrencisi hep C1'e yerleşir (tam %0, C-test formunda %28; ±1 %95). Kapı C2'yi ölçmez.
- Yalnız Rasch modeli, metin etkisi ve tahmin varsayımı; gerçek öğrenci verisi yok.
Mevcut sınavlar kayıtlı yapılandırmasını korur: yeni şekil için okul şablondan yeni sınav açar.

## Sonuç

`result.ts: computeResult`
- Objektif beceri seviyesi = EAP ortalamasının bandı.
- Yazma/konuşma seviyesi = görevlerin seviyelerinin alt medyanı; her görevin seviyesi
  öğretmen kararı, yoksa AI önerisi.
- Genel seviye = beceri seviyelerinin alt medyanı (öğretmen gerekçeyle değiştirebilir).
- Doğrulama sonucu: PASS / FAIL / INCONCLUSIVE, gerekçe kodlarıyla. Puanlama bekleyen
  ya da yetersiz kanıtlı bölüm varsa INCONCLUSIVE. "Tutma olasılığı" objektif
  bölümlerin hassasiyet ağırlıklı birleşik tahmininden `P(theta >= beyan alt sınırı)`.
- Sonuç, ilgili bir satır her değiştiğinde yeniden hesaplanır; kesinleşince donar.

Belirsiz sonuç öğretmene gider (2026-10-18): yazma ve konuşması olmayan bir sınav (ör. hızlı tarama) eskiden
bitince kendiliğinden kesinleşirdi. Artık hesaplanan sonuç sınırda (`NEAR_CUT`, `HIGH_UNCERTAINTY` ya da
üretken beceri farkı) ya da önerilen seviye hesaplanan seviyeden farklıysa (`result.ts: isUncertainResult`)
kesinleşmez, `AWAITING_REVIEW` kalır ve öğretmen karar verir; net sonuç yine kendiliğinden kesinleşir.
Öğretmen nedeni öğrenci sayfasında (sınırda bayrağı ve gerekçeler) ve Bugün listesinde görür; öğrenci bitiş
ekranında sonucun öğretmen tarafından inceleneceğini okur (`awaitingTeacher`, `waitingFor: "REVIEW"`).
Seviye doğrulama sonucunda yerleştirme bayrağı yoktur, davranışı değişmedi.

Öğrenciye analiz verilir, soru verilmez (2026-10-23): öğretmen sonucu yayınlayınca bitiş ekranı ve
`/a/[token]/done/print` bölüm başına doğru/yanlış/boş sayılarını, kaçırılan ve iyi giden konuları
(`student-analysis.ts`, boşluk konuları + `topicOf`, biçim konuları hariç) ve onaylı AI notunu gösterir;
soru metni, seçenek, cevap ve anahtar hiçbir zaman yoktur. Seviyeyi göstermek öğretmenin kararıdır:
`exam_results.level_shown` (yayınlarken kutu, sonradan değiştirilebilir, denetim kaydı); boşsa sınavın
`resultVisibility` değeri belirler. Yazma ve konuşma "öğretmen değerlendirir" satırıdır. Panelde rapor
sayfası iki kopya verir: öğrenci kopyası (`?copy=student`) ve soru soru öğretmen kopyası. AI not taslağı
öğrencinin dilinde yazılır.

## AI puanlama

`grading.ts`: kriter bazlı öneri (görev, tutarlılık, çeşitlilik, doğruluk; konuşmada
akıcılık ve telaffuz). Güvenceler:
- AI yalnızca önerir (`AI_PROPOSED`); nihai seviye öğretmen eylemiyle yazılır.
- Alıntılanan her kanıt cevabın içinde aranır, bulunamayan silinir ve işaretlenir.
- Seviye, görev seviyesinin bir üstüyle sınırlanır.
- Telaffuz transkriptten ölçülemez: her zaman `assessable: false`.
- Boş cevap için AI çağrılmaz (`AI_FAILED: EMPTY`), öğretmen karar verir.
- Her çağrı `ai_runs`'a yazılır.

## Başlangıç bankası

`src/db/seed-bank/`: elle yazılmış, özgün Almanca içerik, 402 soru, 42 metin ve kayıt (2026-10-15 sayımı).
Dilbilgisi 162 (18'i C-test: seviye başına 3), okuma 96, dinleme 72, yazma 36, konuşma 36.
C-test'ler her seviyede 15-20 yazılan boşluktur ve 12 yeni metin iş dışı konulardadır.
Bağımsız bir kör çözümde 229 boşlukta 2 eksik kabul bulundu (`andern`, `Einkauf`), düzeltildi;
`hatte`, `keinerlei`, `Freizeitbetätigung` de kabul edilir.
Almanca kontrolünü bir öğretmen yapmadı; bankada "başlangıç içeriği" etiketiyle durur.
`bank-seed.test.ts` sayıları, anahtar geçerliliğini, doğru şık dağılımını ve em-dash
yokluğunu denetler.

## Sonraki adım

Gerçek sınav verisi birikince `b` değerlerini veriden kestirmek (Rasch kalibrasyonu),
kesim noktalarını bilinen seviyedeki öğrencilerle ayarlamak.
