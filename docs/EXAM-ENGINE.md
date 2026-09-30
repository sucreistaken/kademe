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

`src/db/seed-bank/`: elle yazılmış, özgün Almanca içerik, 229 soru, 36 metin ve kayıt.
Dilbilgisi 78, okuma 67 (18 metin), dinleme 54 (18 kayıt), yazma 12, konuşma 18.
Almanca kontrolünü bir öğretmen yapmadı; bankada "başlangıç içeriği" etiketiyle durur.
`bank-seed.test.ts` sayıları, anahtar geçerliliğini, doğru şık dağılımını ve em-dash
yokluğunu denetler.

## Sonraki adım

Gerçek sınav verisi birikince `b` değerlerini veriden kestirmek (Rasch kalibrasyonu),
kesim noktalarını bilinen seviyedeki öğrencilerle ayarlamak.
