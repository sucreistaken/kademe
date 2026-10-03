# Kademe platformu: çözüm modülleri ve ortak çekirdek

Tarih: 2026-10-03. Dal: `platform/solutions`. Durum: kullanıcı yönü onayladı ("tamam",
2026-10-03), ayrıntı kararları kullanıcının yetkisiyle burada verildi.

## 1. Amaç

Kademe tek ürün değil, tek platform olacak. Bugün iki çözüm var, ileride daha fazlası:

- `language-exam`: Almanca seviye tespiti ve seviye doğrulama (bugün canlıda).
- `hiring`: aday değerlendirme (eski işe alım ürünü, `610da60`), yeniden ve daha iyi.

Aynı kurum ikisini de kullanır, aynı kullanıcılar ikisini de görür.

Öncelik (kullanıcı, 2026-10-04): şimdi **işe alım**. Sonra aynı platforma pozisyon analizi
(bir işin neyi gerektirdiği), muhtemelen çalışan performans değerlendirmesi ve başkaları
gelecek. Sınav çözümü olduğu gibi çalışmaya devam eder; ona sadece çekirdek ayrımının
gerektirdiği kadar dokunulur. Yeni bir çözüm eklemek,
çekirdeğe dokunmadan bir klasör ve bir manifest eklemek demek olmalı.

Başarı ölçütü: (1) sınav davranışı değişmeden çekirdek ayrılır, (2) işe alım çözümü aynı
çekirdeğin üstünde çalışır, (3) üçüncü bir çözüm için gereken tek ortak değişiklik
`solution` enum'una bir değer eklemektir.

## 2. Ortak çekirdek ve çözüm sınırı

Kural: **çekirdek tablolar çözüm tablolarını bilmez; çözüm tabloları çekirdeğe bağlanır.**
Her şeyin ortak çapası `attempt`tir.

| Çekirdek (ortak) | Sahibi |
|---|---|
| `organizations`, `users`, oturum, 2FA, ayarlar, `audit_logs` | çekirdek |
| `candidates` (kişi; UI'da sınavda "öğrenci", işe alımda "aday") | çekirdek |
| `assessments` (davet) + `solution` kolonu | çekirdek |
| `assessment_links` (`/a/[token]`), `attempts` | çekirdek |
| `consent_texts`, `consents`, `deletion_requests`, saklama | çekirdek |
| `proctor_*` (oturum, olay, kanıt, AI ikinci bakış), bütünlük özeti | çekirdek |
| `media_assets`, `transcripts`, `ai_runs`, `message_outbox`, kuyruk | çekirdek |
| Yetkinlik kütüphanesi, puan ölçekleri, pozisyonlar | çekirdek (kurum varlığı) |

Yetkinlik, ölçek ve pozisyon işe alıma özel değil: ileride pozisyon analizi ve performans
değerlendirmesi aynı kurum varlıklarını kullanacak. Bu yüzden panelde ortak "Kütüphane"
altında durur, tabloları önek almaz (`competencies`, `rating_scales`, `positions`), işe alım
bunları referansla kullanır ve davet anında kendi şablon sürümüne dondurur.

| Çözüme özel | Örnek tablolar |
|---|---|
| `language-exam` | `exam_assessments` (yeni), `exam_blueprints`, `items`, `stimuli`, `section_runs`, `item_responses`, `response_gradings*`, `exam_results*` |
| `hiring` | `hiring_assessments` ve `hiring_*` tabloları, ayrıntısı ayrı spec'te (bkz. 9) |

### 2.1 Şema değişiklikleri (çekirdek)

1. `solution` enum'u: `LANGUAGE_EXAM`, `HIRING`.
2. `assessments.solution` (zorunlu). Sınava özel kolonlar (`blueprint_id`,
   `blueprint_name`, `blueprint_snapshot`, `mode`, `claimed_level`) ve
   `claimed_for_verification` kısıtı `exam_assessments` tablosuna taşınır
   (`assessment_id` birincil anahtar ve FK, cascade). Davet anında kopyalama kuralı aynen
   kalır, sadece adresi değişir.
3. `attempts.solution` (davetten kopya, değişmez). "Davet başına tek deneme" kuralı
   `WHERE solution = 'LANGUAGE_EXAM'` kısmi tekil indeksle veritabanında kalır. İşe alımın
   tekrar hakkı aynı davette yeni deneme açar: `(assessment_id, attempt_number)` tekil.
4. `media_assets.attempt_id` (zorunlu, cascade). Bugün medya denemeye `section_runs`
   üstünden ulaşıyor; saklama, transkripsiyon ve süre kapatma işleri artık doğrudan
   `attempt_id` ile çalışır. `section_run_id` ve `item_response_id` sınavın kendi bağı
   olarak kalır; işe alım kendi yanıt satırından medyaya bağlanır.
5. `proctor_events.section_run_id` yerine `segment_kind text` + `segment_run_id uuid`
   (FK yok). Gözetim hangi çözümün hangi bölümünde olduğunu bilmek zorunda değil, sadece
   kaydeder. Sınav bunu `section_run` olarak doldurur, işe alım `stage_run` olarak.
6. `link_status`: işe alım tekrar hakkı için `RETAKE_AVAILABLE` geri gelir. Sınav bu değeri
   hiç üretmez.
7. Kullanıcı rolü `TEACHER` → `MANAGER` olarak yeniden adlandırılır (`ALTER TYPE ... RENAME
   VALUE`, veri kaybı yok). Roller: `OWNER`, `MANAGER` (TR "Yönetici"), `REVIEWER`.
   `HIRING-UX.md`deki "Recruiter" bu roldür. Alım başına roller (değerlendirici, karar veren)
   işe alım çözümünün tablosudur, global rol değildir.

### 2.2 Göç (migration) stratejisi

Canlıda gerçek sınav verisi olabilir. Bu sefer **sıfırlama yok.**

- `drizzle-kit push --force` canlıda bir daha kullanılmaz. Sürümlü göçe geçilir:
  `drizzle-kit generate` ile üretilen SQL dosyaları `drizzle/migrations/` altında,
  elle gözden geçirilir, veri taşıyan adımlar (sınav kolonlarını `exam_assessments`a
  kopyalama, `attempt_id`yi `section_runs` üstünden doldurma) elle yazılır.
- Her canlı göçten önce `pg_dump` yedeği alınır ve geri yükleme yerelde bir kez denenir.
- Göç önce yerelde seed + `verify:exam` verisi üstünde denenir, sonra canlı yedeğin
  yerel (5434) kopyasında bir kez daha. Canlı yedek yerelde kalır, hiçbir yere gönderilmez.
- Canlıya çıkış ayrı bir onay kapısıdır; bu spec onu yetkilendirmez.

## 3. Çözüm modülü sözleşmesi

Her çözüm `src/solutions/<key>/` altında yaşar ve bir manifest verir:

```ts
// src/solutions/types.ts (taslak)
export interface SolutionModule {
  key: "language-exam" | "hiring";
  dbKind: "LANGUAGE_EXAM" | "HIRING";
  basePath: "/exam" | "/hiring";
  label: { tr: string; en: string };
  /** Panel menüsü; sırası menü sırasıdır. */
  nav: Array<{ href: string; label: { tr: string; en: string } }>;
  /** Ortak "Bugün" ekranına giren kartlar. */
  today(orgId: string, userId: string): Promise<TodayItem[]>;
  /** /a/[token] onay ve bilgi adımlarından sonra adayın gideceği yol. */
  candidateStepPath(token: string, state: CandidateStepState): string;
  /** Bu davette gözetim açık mı, hangi seviyede. Null: kapalı. */
  proctorPolicy(assessmentId: string): Promise<ProctorPolicy | null>;
  /** Kişi sayfasında bu çözümden gelen özet satırları. */
  personSummary(candidateId: string): Promise<PersonSummaryRow[]>;
}
```

Kayıt tek yerde: `src/solutions/registry.ts`. Çekirdek çözümleri sadece bu kayıttan tanır;
`import "@/solutions/hiring/..."` çekirdekte yasak (eslint `no-restricted-imports` ile).

## 4. Rotalar

**Panel.** Ortak: `/dashboard` (Bugün), `/people/[id]` (kişi, iki çözümün özetiyle),
`/settings`. Çözümler: `/exam/students`, `/exam/exams`, `/exam/bank`;
`/hiring/positions`, `/hiring/candidates`, `/hiring/library`, `/hiring/compare` (kesin
liste UX belgesinden). Eski adresler (`/students`, `/exams`, `/bank`) `next.config.ts`
yönlendirmesiyle yeni yerlerine gider. Menü çözüme göre gruplu; tek kurum ikisini de
kullandığı için çözüm değiştirici yerine gruplu yan menü (UX belgesi kesinleştirir).

**Aday.** `/a/[token]` (onay), `/info`, `/rights`, `/check` (gözetim açıksa) ve `/done`
ortaktır; içerik adımı çözümün: `/a/[token]/exam` (bugünkü), `/a/[token]/stage/[n]`
(işe alım). Tek proctoring sağlayıcısı (`ProctorProvider`) layout'ta kalır; gözetim kapalı
davette hiçbir şey başlatmaz.

**Aday API.** Ortak: `/api/c/[token]/{consent,info,rights,device-check,state,problem,
heartbeat,media/*,proctor/*}`. Çözüme özel uçlar kendi önekinde:
`/api/c/[token]/exam/*` (bugünkü `answer`, `section/*`, `listening-audio` buraya taşınır)
ve `/api/c/[token]/hiring/*`. Her çözüm ucu önce `assessment.solution`ı kontrol eder,
uymazsa 404.

## 5. UI temeli: shadcn/ui

- Neden: yığın zaten Tailwind 4 + `clsx` + `tailwind-merge` + `lucide-react`. shadcn
  bileşenleri repoya kopyalanır (paket kilidi yok), Radix ile erişilebilirlik hazır gelir,
  tema CSS değişkenleriyle yönetilir. Uzun vadede her çözüm aynı bileşen setini kullanır.
- Kademe token'ları shadcn değişkenlerine eşlenir: `--primary` = `#0E6A57`,
  `--background` = canvas, `--card` = surface, `--border` = line, `--muted-foreground` =
  muted, `--radius` 10px (6/10/14 skalası korunur), font Figtree.
- `docs/design/RULES.md` kuralları shadcn sarmalayıcılarında yaşar: `Button` tek dolu
  varyant + zorunlu `disabledReason`, durum için `StatusDot` (rozet yok), onay diyaloğu
  yerine geri al şeridi.
- "Yumuşak" görünüm (geniş boşluk, yumuşak gölge, sakin renk) token seviyesinde tanımlanır;
  kesin değerler `docs/design/HIRING-UX.md` 7. bölümden gelir ve `RULES.md` güncellenir.
- Mevcut sınav ekranları kademeli geçer; çekirdek ayrımı adımında görünüm değişmez.

## 6. Hata ve güvenlik değişmezleri (bozulmaz)

`docs/STATUS.md` "Değişmezler" listesi aynen geçerli. Eklenenler:

- Çözüm A'nın aday ucu çözüm B'nin davetine cevap vermez (404, sızıntı yok).
- Gözetim işaretleri hiçbir çözümde kimseyi otomatik elemez ya da başarısız saymaz.
- AI hiçbir çözümde nihai karar yazmaz; insan onaylar ya da gerekçeyle değiştirir.
- Çekirdek kodu çözüm koduna import etmez.

## 7. Test ve doğrulama

- Her adımda: `tsc`, `eslint src scripts`, `pnpm test`, `pnpm build`.
- Çekirdek ayrımı adımı: `pnpm verify:exam` aynen geçmeli (rota önekleri güncellenir,
  kontroller değişmez), gözetim ve medya testleri `attempt_id` üstünden.
- Yeni: çapraz çözüm testi (sınav token'ıyla işe alım ucuna istek 404), registry testi.
- Gerçek tarayıcıda (Claude in Chrome, sahte medya kapalıyken kullanıcının cihazında):
  bir sınav ve bir işe alım değerlendirmesi uçtan uca.

## 8. Alt projeler ve sıra

1. **UI temeli:** shadcn kurulumu, tema eşlemesi, `ui/` sarmalayıcıları. Ekran değişmez.
2. **Çekirdek ayrımı:** 2.1 şema, sürümlü göç, `src/solutions/language-exam`, registry,
   rota önekleri, yönlendirmeler, gruplu menü. Sınav davranışı aynı kalır.
3. **İşe alım çözümü:** `src/solutions/hiring`, `HIRING-UX.md`ye göre; doğrudan shadcn.
4. **İşe alımda gözetim:** şablon başına aç/kapa, aşamalı aday akışına bağlama.
5. **Benchmark turu:** `HIRING-UX.md` "geçmemiz gereken" listesine karşı her sayfa ve
   akış, kanıtla. Sonra canlıya çıkış onayı.

## 9. Bu belgede olmayan

İşe alım çözümünün veri modeli ve değerlendirme mantığı (yetkinlik, ölçek, ağırlık,
çok değerlendiricili bağımsız puanlama, karar, tekrar hakkı) ayrı spec'te:
`docs/superpowers/specs/2026-10-03-hiring-solution-design.md`, `HIRING-UX.md` bittikten
sonra yazılır.

Kurum başına çözüm aç/kapa yok (kullanıcı kararı: aynı kurum ikisini de kullanır).
Registry bunu ileride tek kolonla mümkün kılar.
