# Y3 AI builder

Ekran: `/positions/[id]/templates/[tid]/versions/[v]/ai`
Tasarım kaynağı: `docs/design/kademe-canvas.html`, artboard Y3.

Yönetici iş ilanını yapıştırır, model şemalı bir taslak üretir, taslak **öneri
kartı** olarak listelenir. Hiçbir öneri kendiliğinden uygulanmaz.

## Sınır

AI adayı **puanlamaz, sıralamaz, elemez, videodan duygu okumaz.** Bu ekranın tek
işi değerlendirmeyi tasarlamaya yardım etmektir. Bu sınır üç yerde birden yazılı:
sistem prompt'unda (`SYSTEM_PROMPT`), ekranın alt metninde ve `ai_purpose`
enum'unda (duygu çıkarımı için karşılık bilerek yok).

Model **çoktan seçmeli soru öneremez.** `SUGGESTABLE_ACTIVITY_TYPES` listesinde
`SINGLE_CHOICE` ve `MULTI_CHOICE` yok: çoktan seçmeli soru bir cevap anahtarı
taşır, Bilgi Skoru'nu besler ve yanlış anahtar doğru cevabı sessizce yanlış
sayar. Neyin doğru sayılacağı yöneticinin kararıdır.

## Dosyalar

| Dosya | İş |
|---|---|
| `src/lib/ai.ts` | `AiProvider` arayüzü, Gemini + NVIDIA + OpenRouter sağlayıcıları, ortak yeniden deneme döngüsü, anahtar yoksa açıkça reddeden hal |
| `src/lib/template-draft.ts` | zod şeması, JSON Schema, prompt, doğrulama, normalize. Tamamen saf, `template-draft.test.ts` ile 32 test |
| `src/lib/template-draft-job.ts` | çağrı + bir onarım denemesi + her çağrı için `ai_runs` kaydı |
| `.../versions/[v]/ai/page.tsx` | ekran, sadece okur |
| `.../versions/[v]/ai/actions.ts` | öneri üretme ve kabul/geri alma yazımları |
| `.../versions/[v]/ai/ai-builder.tsx` | kart arayüzü |
| `scripts/verify-ai-draft.ts` | `pnpm verify:ai`, gerçek bir ilan metnini uçtan uca koşturur |

## Akış

1. Ekran açılır, `positions.job_description` varsa metin alanı önden dolar.
   İlan metni buradan pozisyona geri **yazılmaz**.
2. "Önerileri üret" -> `generateTemplateDraft`. Çıktı zod ile doğrulanır.
   Bozuksa **bir** onarım denemesi yapılır, o da tutmazsa dürüstçe hata döner ve
   şablona hiçbir şey yazılmaz.
3. Öneriler kart olarak listelenir: aşama kartları, sonra yetkinlik kartları.
   Her kartta kabul et / düzenle / sil, hepsi geri alınabilir.
4. "Kabul et" ilgili aşamayı ve aktivitelerini DRAFT versiyona yazar.
   Yetkinlik kartı ancak onu ölçen aşamalardan biri kabul edildikten sonra
   kabul edilebilir; o zamana kadar düğme nedenini yazar.

## Süre bütçesi

İlk gerçek koşu 106 dakikalık, altı aşamalı, dördünde dosya yükleme isteyen bir
değerlendirme üretti. Hiçbir aday bunu bitirmez; canvas referansı 3 aşama, 24
dakika. Sınırlar `DRAFT_BUDGET`'ta:

| Sınır | Değer |
|---|---|
| Toplam süre | 15-30 dk, hedef 25 |
| Aşama sayısı | en fazla 4 (`normalizeDraft` fazlasını atar) |
| Aşama süresi | en fazla 12 dk |
| Kayıt cevabı | en fazla 180 sn |
| Dosya yükleme | en fazla 1 aşamada |

Sınırlar hem prompt'ta yazılı hem de `checkDraftBudget` ile sonradan kontrol
ediliyor: sadece prompt'ta duran bir sınır rica olur. Bütçe aşılırsa şema hatası
gibi davranılır, **onarım denemesi bu geri bildirimle tetiklenir.**

Onarımdan sonra da aşılıyorsa taslak atılmaz, ekranda uyarıyla gösterilir:
kartlar tek tek kabul edilebilir, süreleri kartta yazıyor ve düzenlenebiliyor.
Dört dakika bekletip elde hiçbir şey bırakmamak daha kötü bir takas olurdu. O
durum `ai_runs`'a da error satırı olarak düşer.

## Geçici hatalar ve yeniden deneme

NVIDIA'nın paylaşımlı uç noktası beş koşunun ikisinde 503 "Service temporarily
overloaded" döndü, Gemini de beş koşunun ikisinde 503 "This model is currently
experiencing high demand" verdi. 503, 429, 408 ve 5xx için iki ek deneme var.
402, 401, 400 için deneme **yok**: kredi on beş saniyede gelmez, sadece bekleme
uzar. Zaman aşımı da denenmez.

Bekleme süresi sağlayıcıya bağlı (`ProviderConfig.retryDelaysMs`), çünkü aynı
sayı iki modelde çok farklı anlama geliyor:

| Sağlayıcı | Beklemeler | Neden |
|---|---|---|
| `gemini` | 1 sn, 4 sn | Cevap 20-35 sn. 20 sn ölü bekleme koşunun çoğu olurdu |
| `nvidia`, `openrouter` | 5 sn, 15 sn | Cevap dakikalar sürüyor, 20 sn yuvarlama hatası |

Gemini'de **404 genel olarak yeniden denenmez**: `GEMINI_MODEL`'deki bir yazım
hatası kendiliğinden düzelmeyen bir 404 üretir ve o 404 gövdesinde bulunamayan
modelin adını taşır. Sadece **gövdesi boş** bir 404 yeniden denenir; o, API'nin
cevabı değil, uç nokta ya da proxy takılması (`isRetryableGeminiFailure`).

### Sağlayıcı düşmesi

Gemini denemelerini tüketirse ve `NVIDIA_API_KEY` varsa, istek bir kez NVIDIA
üzerinden tekrarlanır. Sadece "denemeler tükendi" hatası düşer: yanlış model
adı, güvenlik bloğu veya API'nin reddettiği bir istek ikinci sağlayıcıda da aynı
şekilde başarısız olur, ilan metnini oraya göndermek boşuna bir ifşa olurdu.

Bu sessiz olmaz. `DraftOutcome.fellBackTo` doldurulur, çünkü bekleme
saniyelerden dakikalara çıkar ve yirmi kat uzayan bir spinner kullanıcıya donma
gibi görünür. Ekran metni `aiBuilder.fellBackTo` anahtarında.

Her yeniden deneme `ai_runs`'a ayrı bir satır yazar, yoksa uç noktanın ne sıklıkta
meşgul olduğu kayıtta görünmezdi. Ekran, cevap geldikten sonra kaç istekte
alındığını yazar.

Not: sunucu aksiyonu tek istek/tek cevap olduğu için ekranda canlı "2/3 deneniyor"
sayacı yok; bunun için streaming ya da yoklama gerekirdi. Bekleme metni yeniden
denemenin olabileceğini söylüyor, sonuç geldiğinde de kaç istek gittiği yazıyor.

## Yayınlanmış versiyon

`0001_immutability.sql` yayınlanmış versiyona yazmayı reddediyor. Bu yüzden
kabul işlemi hedefi kendisi seçer (`resolveDraftTarget`):

1. URL'deki versiyon DRAFT ise oraya yazılır.
2. Yayınlanmışsa aynı şablonun en yeni DRAFT'ı kullanılır.
3. Hiç taslak yoksa `createDraftFrom` ile yayınlanmış versiyondan yeni bir
   taslak açılır ve öneri oraya gider. Ekran bunu yazıyla söyler.

## Yetkinlik önerisi

Kabul edilen yetkinlik önce kütüphanede aranır (isim, büyük/küçük harf
duyarsız). Varsa yeniden kullanılır; yoksa org'un skalasıyla kütüphaneye
eklenir. "Geri al" sadece bu kabulün eklediği ve başka hiçbir aşamanın
kullanmadığı yetkinliği kütüphaneden siler. Zaten var olan bir yetkinlik org'a
aittir, bu öneriye değil.

## Sağlayıcı seçimi

NVIDIA ve OpenRouter OpenAI uyumlu sohbet API'si konuştuğu için tek bir istemci
iki base URL ile çalışıyor (`OpenAiCompatibleProvider`). **Gemini uyumlu değil**:
istek gövdesi, cevap gövdesi ve anahtarın gittiği yer farklı, o yüzden ayrı bir
`GeminiProvider` var. Yeniden deneme döngüsü, geçici/kalıcı ayrımı ve
`AiJsonResponse` sözleşmesi ortak. Seçim `chooseProvider` ile yapılır, saf
fonksiyon, `src/lib/ai.test.ts` ile test edilmiş.

| Değişken | İş |
|---|---|
| `AI_PROVIDER` | `gemini`, `nvidia` veya `openrouter`. Yazılıysa o kullanılır |
| `GOOGLE_AI_API_KEY`, `GEMINI_MODEL` | varsayılan `gemini-3.6-flash` |
| `NVIDIA_API_KEY`, `NVIDIA_MODEL` | varsayılan `nvidia/nemotron-3-ultra-550b-a55b` |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | varsayılan `anthropic/claude-sonnet-5` |

`AI_PROVIDER` boşsa sıra **gemini, nvidia, openrouter**. Eskiden kural "para
harcamak açık tercih olmalı" idi ve ücretsiz NVIDIA kazanıyordu; o kural bekleme
ölçülmeden önce yazılmıştı. Yeni gerekçe **gecikme, para değil**: NVIDIA'da bir
taslak 131-275 sn sürüyor ve bu bir server action'a sığmıyor, Gemini 20-35 sn
sürüyor ve sığıyor. Çağrı başına para yazan OpenRouter yine en sonda.

`AI_PROVIDER=gemini` yazılıp `GOOGLE_AI_API_KEY` yoksa sistem sessizce diğerine
düşmez, reddeder: ilan metnini kimsenin adını koymadığı bir alt işleyiciye
göndermek olurdu. (Yukarıdaki düşme bundan farklı: orada NVIDIA zaten bu
kurulumun kullandığı bir sağlayıcı ve ilk tercih denenip tükenmiş oluyor.)

### Gemini şeması

`TEMPLATE_DRAFT_JSON_SCHEMA` her nesne seviyesinde `additionalProperties: false`
yazıyor, çünkü OpenAI strict mode bunu şart koşuyor. Gemini'nin `responseSchema`
alanı JSON Schema değil, OpenAPI 3.0 alt kümesi kabul ediyor ve tanımadığı
anahtarı yok saymak yerine isteği tümden reddediyor. `toGeminiSchema` şemayı
kopyalayıp sadece `type`, `properties`, `required`, `items`, `enum`,
`description`, `nullable` anahtarlarını bırakıyor.

Bu güvenliği zayıflatmıyor. Model ile veritabanı arasındaki koruma hiçbir zaman
sağlayıcıya gönderilen şema değildi, `parseDraftAnswer` ve zod'du; zod nesne
şemaları tanımadığı anahtarları zaten atıyor, yani modelin uydurduğu bir alan
hiçbir şey yazılmadan düşüyor. Sağlayıcı tarafındaki şemanın kazandırdığı şey
daha iyi bir ilk deneme, güvenlik değil.

`toGeminiSchema` girdisine **dokunmuyor**: `TEMPLATE_DRAFT_JSON_SCHEMA` modül
seviyesinde tek bir nesne ve OpenAI uyumlu yola da aynısı veriliyor, yerinde
değiştirmek diğer sağlayıcıların isteklerini sessizce bozardı. Bunu sabitleyen
bir test var.

### Gemini cevabı

`readGeminiBody` `parts[].text` alanlarını birleştirir ve `thought: true` olan
parçaları **atar**. `readStreamedBody`'nin NVIDIA'nın `reasoning_content`
alanını atmasıyla aynı sebep: modelin ilan metni üzerine yaptığı özel düşünme
cevap değil, ve tutmak onu parser'a ve oradan yöneticinin ekranına taşırdı.

`finishReason: MAX_TOKENS` "cevap JSON bitmeden kesildi" hatasına dönüşür.
`promptFeedback.blockReason` ve `finishReason: SAFETY` yeniden denenmeyen,
bloğun adını söyleyen bir hata olur: bir iş ilanının güvenlik filtresine
takılması olağan ve bunu ağ hatası diye raporlamak yöneticiyi olmayan bir
bağlantı sorununu aramaya gönderirdi.

Token sayımı: `outputTokens = candidatesTokenCount + thoughtsTokenCount`. Google
düşünmeyi çıktı olarak faturalandırıyor, yani diğer sağlayıcıların
`completion_tokens` değeriyle karşılaştırılabilir olan bu. Duman testinde
düşünme cevabın dört katıydı (322'ye karşı 1248); sadece `candidatesTokenCount`
yazmak `ai_runs`'ın tükettiğimizi eksik göstermesi olurdu, bir denetim tablosu
tam da bunu yapmamalı. `cost_usd` NVIDIA'daki gibi boş kalıyor: REST cevabı
fiyat taşımıyor ve sabit yazılmış bir tarife sessizce çürür.

Model notları:

- `gemini-3.6-flash`: `responseSchema` ile şemaya uyuyor, Türkçesi düzgün.
  Gerçek prompt ile ölçülen beş koşu: **29.3, 27.4, 23.4, 20.1, 35.3 sn**
  (ikisinde 503 çıktı ve yeniden deneme yuttu). Zaman aşımı 120 sn, token tavanı
  32000. Ayrı bir **duman testi** (kısa, bu ürünün prompt'u olmayan bir istek)
  9.4 sn ve in=185 / out=322 / thoughts=1248 vermişti; hiçbir sınır o sayıdan
  türetilmedi, yukarıdaki beş koşu `pnpm verify:ai` ile ölçüldü.
  `thinkingConfig` bu turda varsayılanında bırakıldı: düşünmeyi kısmak
  gecikmenin bariz kolu ama kısıtın büyüklüğü tahminle değil ölçümle
  konmalı, ve düşük konursa JSON'u hızlandırmak yerine kesiyor.

- `nvidia/nemotron-3-ultra-550b-a55b`: JSON şemasına uyuyor, Türkçesi düzgün.
  Akıl yürüten model, cevap dakikalar sürebilir; zaman aşımı 300 sn, token
  tavanı 32000 (akıl yürütme tokenları da cevaptan sayılıyor). Ekran beklerken
  "AI öneri üretiyor" durumunu gösteriyor.
- `nvidia/nemotron-3-super-120b-a12b`: **kullanma.** Şema verilmesine rağmen
  düşüncesini cevabın içine yazıyor.
- `anthropic/claude-sonnet-5`: `structured_outputs` destekli, taslak başına ~2
  sent, ama OpenRouter hesabında kredi gerekiyor. Bu model `temperature`
  parametresi kabul etmiyor, gönderilmiyor.

Model bazen JSON'un etrafına laf ediyor. `parseDraftAnswer` iki toleransa izin
verir: kod bloğunu açar ve en dıştaki `{...}` bloğuna kırpar. Şemaya uymayan
çıktı yine reddedilir, tahminle tamamlanmaz.

## Maliyet ve iz

Her model çağrısı `ai_runs`'a düşer: `purpose=TEMPLATE_DRAFT`, model, token
sayıları, `cost_usd`, `prompt_hash`, hata varsa `error`. Onarım denemesi ayrı
bir satırdır, sağlayıcı düşmesine yol açan başarısızlık da ayrı bir satırdır.
Prompt saklanmaz, sadece hash'i: içinde ilan metni var. Ne NVIDIA ne de Gemini
uç noktası maliyet bildiriyor, `cost_usd` tahmin yazmak yerine boş kalıyor.

## İlan metni sınırları

`JOB_AD_MIN_CHARS = 120`, `JOB_AD_MAX_CHARS = 20000`, `jobAdProblem(text)`.
Tabanı olan sebep şu: iki satırlık bir ilan modele tutunacak hiçbir şey vermiyor
ve model her işe uyan genel aşamalar yazıyor, yani yöneticinin kullanamayacağı
taslak. İki ayrı kod var çünkü iki uç zıt tavsiye gerektiriyor: 20000 karakteri
aşan bir yapıştırmaya "çok kısa" demek, düzeltme "daha az yaz" iken yöneticiye
"daha çok yaz" demek olurdu.

## Doğrulama durumu

- `pnpm test`: 175 test geçiyor. Bunların 32'si `template-draft.test.ts`
  (şema/onarım/normalize/prompt sınırları/ilan metni sınırları), 25'i
  `ai.test.ts` (sağlayıcı seçimi, `toGeminiSchema`, `isRetryableGeminiFailure`,
  `readGeminiBody`).
- `pnpm verify:ai`, Gemini anahtarıyla gerçek ilan metniyle **beş kez**
  koşuldu: 29.3, 27.4, 23.4, 20.1, 35.3 sn, hepsi 3 aşama ve 23-28 dakikalık
  taslak üretti. İki koşuda 503 çıktı, yeniden deneme yuttu, her biri `ai_runs`'a
  ayrı satır yazdı. Token: in=1209, out=3421-5458.
- `GEMINI_MODEL` bilerek yanlış yazılarak koşuldu: gövdeli 404, **0.87 sn**
  içinde, yeniden deneme yapmadan ve NVIDIA'ya düşmeden başarısız oldu, tek bir
  `ai_runs` hata satırı yazdı.
- Sağlayıcı düşmesi, `fetch` sahtelenerek doğrulandı: Gemini 503'te 3 deneme
  (5.0 sn), sonra NVIDIA cevapladı, `fellBackTo=nvidia`.
- Kabul/geri al yolu tarayıcıda tıklanmalı. Bu adım henüz yapılmadı.
