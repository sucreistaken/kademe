# Saklama temizliği (retention purge)

GDPR tarafının son parçası. `purge-retention` işi, saklama süresi dolmuş medyayı ve
aday kayıtlarını bulur, önce işaretler, bir hafta sonra gerçekten siler.

**Bu tur kuru koşu. Varsayılan yolda hiçbir şey silinmiyor.** Silmeyi açan iki anahtar
aşağıda, "Silmeyi açmak" bölümünde.

## Dosyalar

| Dosya | İş |
|---|---|
| `src/lib/retention.ts` | Tarih aritmetiği, sorgular, iki aşamalı silme |
| `src/lib/retention.test.ts` | 29 birim testi, veritabanı gerektirmez |
| `src/app/api/cron/purge-retention/route.ts` | Korumalı cron ucu, varsayılanı rapor |
| `scripts/verify-retention.ts` | Gerçek veritabanına karşı kuru koşu raporu |

## İki ayrı saat

İki sayı, `organizations` satırında. Birbirinden bağımsız, ayrı çalışıyorlar.

| Ayar | Varsayılan | Neyi siler | Saat ne zaman başlar |
|---|---|---|---|
| `mediaRetentionDays` | 180 gün | Kayıtlar (`media_assets` + depodaki nesne) | **Karar** verildiği an |
| `candidateRetentionDays` | 730 gün | Aday kaydının tamamı (`candidates`, cascade ile altındaki her şey) | **Son temas** |

Medya saatinin kayıttan değil karardan başlaması bilinçli: incelemesi üç ay süren bir aday
videosunu, henüz kimse izlememişken silmek anlamsız olurdu. Kararı verilmiş bir adayın
videosu ise işini görmüştür, aday kaydı hâlâ dursa bile.

**Çapa (anchor) alanları ve yedekleri.** Bir satırın yaşını hangi tarihten sayıyoruz:

```
medya   : coalesce(en son decisions.at, assessments.created_at, media_assets.created_at)
aday    : coalesce(candidates.last_contact_at, candidates.created_at)
```

Yedekler önemli. `media_assets.stage_run_id` nullable, yani hiçbir aşamaya bağlanmamış
öksüz bir yükleme olabilir; çapası olmasa sonsuza kadar yaşardı. Aynı şekilde kararı hiç
verilmemiş bir aday, davet tarihinden sayılarak eninde sonunda kapsama girer.

Sınır dışlayıcı: çapası tam kesim anına eşit olan satır bu koşuda değil, bir sonrakinde
alınır.

## İki aşama, arada yedi gün

```
    gün 0                         gün 7
      |                             |
  YUMUŞAK SİLME  ---- 7 gün ---->  SERT SİLME
  media_assets.purge_after = now+7  depodaki nesne silinir, sonra satır
  candidates.deleted_at   = now     aday satırı silinir (cascade)
      |                             |
  geri alınabilir                geri alınamaz
```

Yedi günün amacı bu: yanlış girilmiş bir saklama süresi, bozuk bir çapa ya da kayan bir
saat, geri dönülmez bir silme olarak değil, bir hafta boyunca işaretli duran satırlar
olarak görünür. `purge_after` alanını elle `NULL` yapmak yumuşak silmeyi geri alır.

**Sıra: önce nesne, sonra satır.** Depodaki nesne silinemezse satır yerinde bırakılır ve
bir sonraki koşu tekrar dener. Tersi sırada, silemediğimiz bir nesneye işaret eden tek
kaydı da kaybederdik ve kovada kimsenin bilmediği bir dosya kalırdı.

**Aday silmenin cascade tuzağı.** `candidates` satırını silmek `assessments` ->
`attempts` -> `stage_runs` -> `media_assets` zincirini cascade ile götürür. Satırlar
gider, kovadaki nesneler kalır. Bu yüzden aday sert silmesi önce o adaya ait tüm
`storage_key`'leri toplayıp nesneleri siler, sonra satıra dokunur. Nesnelerden biri bile
silinemezse o aday bu koşuda atlanır, yumuşak silinmiş halde kalır ve sonraki koşuda
tekrar denenir.

## Audit

Her yıkıcı eylem `audit_logs`'a satır yazar. `actor_id` **null**: işin arkasında bir insan
yok, kim olduğunu `action` öneki söylüyor.

| `action` | `subject_type` | `subject_id` |
|---|---|---|
| `retention.media.soft_delete` | `media_asset` | medya id |
| `retention.media.purge` | `media_asset` | medya id |
| `retention.candidate.soft_delete` | `candidate` | aday id |
| `retention.candidate.purge` | `candidate` | aday id |

`meta` içinde çapa tarihi, kullanılan saklama süresi, `storage_key` ve boyut duruyor.
Audit satırı `org_id`'ye bağlı, adaya değil; yani bir adayı silmek onun silindiğinin
kanıtını cascade ile götürmüyor. Aylar sonra "bu aday ne zaman, hangi kurala göre
silindi" sorusu cevaplanabilir kalıyor.

**Rapor modu hiçbir şey yazmaz, audit satırı bile.** Sadece okuma yapan bir koşunun iz
bırakmasının anlamı yok.

## Sınırlar

- Her tür için koşu başına en çok `batch` satır, varsayılan 200, tavan 2000. Batch dışında
  kalanlar yanıtta `remaining` olarak raporlanır, sessizce yutulmaz.
- Her adım idempotent. İşaretlenmiş satır yumuşak sorguya, silinmiş satır hiçbir sorguya
  uymaz. İki kere çalıştırmak zararsız.
- Gün = 24 saat. Takvim günü değil. 180 ve 730 günlük pencerelerde yaz saati farkı
  anlamsız, karşılığında aynı girdi hep aynı anı üretiyor.
- Sıfır veya negatif saklama süresi hata fırlatır. "0 gün" sessizce "her şeyi sil" demek
  olurdu. Bir organizasyonun ayarı bozuksa o organizasyon koşudan çıkarılır, yanıtta
  `error` alanıyla söylenir, geri kalanlar normal çalışır. Tek bozuk ayar bütün gecelik
  işi düşürmüyor.

## Silmeyi açmak

**Şu an hiçbir ortamda açık değil.** Silme için İKİ anahtarın da açık olması gerekiyor:

```bash
# 1. ortam değişkeni (.env ya da Cloud Run ayarı)
RETENTION_PURGE_ENABLED=true

# 2. istekte açık parametre
POST /api/cron/purge-retention?apply=1
```

Tek başına hiçbiri yetmez. `?apply=1` var ama ortam değişkeni yoksa yanıt yine `REPORT`
döner ve `switches.applyAllowed: false` yazar. Kütüphane seviyesinde karşılığı
`runRetention({ apply: true })`; parametresiz `runRetention()` saf okumadır.

İkisinin ayrı olmasının sebebi: ortam değişkeni, silmenin hiç düşünülmediği bir makinede
yanlış yapılandırılmış bir zamanlayıcının ya da kopyalanmış bir curl satırının bir şey
silmesini engelliyor; parametre ise silmenin serbest olduğu makinede bile düz bir çağrının
sadece rapor vermesini sağlıyor.

Açmadan önce yapılacaklar, sırayla:

1. `npx tsx scripts/verify-retention.ts` çalıştır, ne silineceğini oku.
2. Geliştirme veritabanında üç oturumun test verisi var. Yedek al ya da başka bir
   veritabanına geç.
3. Önce `RETENTION_PURGE_ENABLED=true` + `?apply=1&batch=1` ile tek satırla dene.
4. `audit_logs`'ta `retention.%` satırlarını kontrol et.

## Doğrulama

```bash
npx tsx scripts/verify-retention.ts   # gerçek veritabanına karşı kuru koşu
npx vitest run src/lib/retention.test.ts
```

`verify-retention.ts` sadece rapor basmıyor, kuru koşunun gerçekten kuru olduğunu da
ispatlıyor: koşudan önce ve sonra beş sayı alıyor (işaretli medya, yumuşak silinmiş aday,
medya satırı, aday satırı, `retention.%` audit satırı) ve hepsinin aynı kaldığını
gösteriyor. Kuru olduğunu ispatlayamayan bir kuru koşunun değeri yok.

Ayrıca bir sonda var: temiz bir veritabanında bütün sayılar 0 çıkar ve 0 hiçbir şey
ispatlamaz, bozuk bir join de sonsuza kadar 0 raporlar ve sağlıklı görünür. Bu yüzden
script aynı raporu bir de `now` 1200 gün ileri itilmiş halde çalıştırıyor; satırlar
gerçekten eşleşiyor mu orada görünüyor. Bu da saf okuma, sadece farklı bir `now`.

2026-09-08 tarihli koşu: bugün için her şey 0 (en eski veri Ağustos 2026, hiçbir şey 180
günü doldurmamış). 1200 gün ileri itilince 23/23 medya ve 24/24 aday eşleşti, 3.4 MB.
Yani sorgular çalışıyor, sadece henüz kimsenin süresi dolmamış.

## Silme açılmadan önce bakılması gereken bir yer

`responses.payload.mediaAssetId` bir jsonb alanı, yabancı anahtar değil
(`src/db/schema/types.ts`). Medya sert silindiğinde `media_assets` satırı gidiyor ama
`responses` içindeki bu id olduğu yerde kalıyor, yani boşluğa işaret eden bir id oluyor.
Bugün bunun bir zararı yok çünkü silme kapalı ve hiçbir satır bu duruma düşmedi. Silme
açılmadan önce Y5 inceleme ekranının "medya kaydı yok" halini düzgün gösterdiği
doğrulanmalı; aksi halde saklama süresi dolmuş bir adayın aşaması hata verebilir.

Aday tarafındaki durum temiz: `candidates.deleted_at` dolu olan aday
`src/lib/manager-data.ts` listesinden düşüyor ve `src/lib/candidate-flow.ts` linki
geçersiz sayıyor. Yani yumuşak silme daha ilk günden gerçek bir etki yaratıyor, yedi gün
boyunca hiçbir şey olmamış gibi durmuyor.

## Şemayla ilgili bir not

`docs/PLAN.md` ve devir notları "assessments.deletedAt" diyor ama şemada öyle bir sütun
yok: `deleted_at` **`candidates`** tablosunda duruyor (`src/db/schema/assessment.ts`).
İş şemanın gerçek haline göre yazıldı, yani yumuşak silme aday satırını işaretliyor.
Zaten doğrusu da bu: saklama süresi adayın kendisine ait, tek tek davetlere değil.
