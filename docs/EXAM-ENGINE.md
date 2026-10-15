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
`cTestOpenings`, `isCTestOnly`).

Hazır şablonlar sabit formdur. Yerleştirme: DILBILGISI = A1'den C2'ye altı C-test (onSET
düzeni), 30 dk; A2-C1 okuma ve A2-B2 dinleme (seviye başına bir metin ya da kayıt); toplam
77 dk. Hızlı seviye taraması: A2, B1, B2 üç C-test, 15 dk. AI oluşturucu şablonu süre
oranıyla seçer (`templates.ts: examTemplateFor`): süre uyumu puanı
`30 * |log2(şablon dakikası / hedef)|`; beceri söylenmediğinde hızlı tarama ile yerleştirme
arasındaki sınır yaklaşık 34 dakikadır. Yeniden ölçekleme `floor(dakika / 5)` metin tutar
(en az bir), orta seviyeleri seçer. Önceki şablon: 64 dk, açılışta tek C-test ve seviye
başına 3 çoktan seçmeli.

Simülasyon (`scripts/simulate-placement.ts`, seviye başına 4000 koşu, metin başına rastgele
etki sd 0.5, birleşik objektif seviye, "tam / ±1 seviye"):

| Form | A1 | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| Yerleştirme, önce | 66/100 | 76/100 | 79/100 | 77/100 | 68/100 | 39/99 |
| Yerleştirme, sonra | 70/100 | 81/100 | 83/100 | 81/100 | 73/100 | 47/100 |
| Hızlı tarama, önce | 65/99 | 66/100 | 64/99 | 62/99 | 55/99 | 62/98 |
| Hızlı tarama, sonra | 65/100 | 75/100 | 70/100 | 76/100 | 60/100 | 28/98 |

Kapı (A1-C1, tolerans tam -0.02, ±1 -0.01) iki formda da geçti. Hızlı taramada C2 tam isabeti
%62'den %28'e düştü: en zor metni B2, C2 öğrencisini ayıramaz; kabul edildi. C2 yerleştirmede
de zayıf (%47). Yalnız Rasch modeli ve metin etkisi varsayımı; gerçek öğrenci verisi yok.
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
