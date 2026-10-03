# İşe alım çözümü: veri modeli ve kurallar

Tarih: 2026-10-04. Dal: `platform/solutions`. Üst belge:
`docs/superpowers/specs/2026-10-03-platform-solutions-design.md` (çekirdek, çözüm sözleşmesi).
Ekranlar ve gerekçeler: `docs/design/HIRING-UX.md` (bundan sonra "UX"). Bu belge UX'in
bölüm 3, 4.2, 4.6 ve 7'sini tablolara, kurallara ve testlere çevirir; ekran tasarımını
tekrarlamaz.

Taban: eski ürün (`610da60`): `catalog.ts`, `library.ts`, `evaluation.ts`, `scoring.ts`,
`server/review.ts`, `server/retake.ts`. Değişiklikler UX 3.12'deki tabloya göre.

## 1. Kütüphane (çekirdek, kurum varlığı, önek yok)

Pozisyon analizi ve performans çözümleri de okuyacağı için bu tablolar `src/db/schema/library.ts`
altındadır ve hiçbir işe alım tablosunu bilmez.

| Tablo | Kolonlar (özet) | Not |
|---|---|---|
| `rating_scales` | org, ad, `min_value` 1, `max_value` 5 | Org başına bir varsayılan (5 seviye) seed'lenir |
| `scale_levels` | scale, value, `label` I18n | UX 3.3 genel adları ("Beklenen düzeyde") |
| `competencies` | org, `name` I18n, `description` I18n, scale, `archived_at` | Silme yok, arşiv var |
| `competency_anchors` | competency, value, `body` I18n | **Yeni.** Yetkinliğe özel davranış çapası. 1, 3, 5 yayın için zorunlu; 2, 4 opsiyonel |
| `observation_tags` | competency, polarity (+/-), `label` I18n, order, archived | Eski `evaluation_options` |
| `positions` | org, ad, ekip, kısa tanım, ilan metni, beceriler, diller, archived | Eski `positions`, süreç alanları olmadan |
| `position_competencies` | position, competency, `weight` (0-100), `expected_level` (null olabilir), order | **Yeni.** Pozisyonun yetkinlik profili |

Kural: kütüphane değişikliği yayınlanmış hiçbir değerlendirmeyi değiştirmez; çünkü işe alım
yayın anında her şeyi kopyalar (bkz. 2.3). Seed: 8 yetkinlik (eski seed'den), çapaları ve
etiketleriyle, TR+EN.

## 2. İşe alım tabloları (`hiring_` öneki, `src/db/schema/hiring.ts`)

### 2.1 Alım ve ekip

| Tablo | Kolonlar |
|---|---|
| `hiring_openings` | org, `position_id`, ad, `status` (`DRAFT`,`OPEN`,`CLOSED`), `deadline_at`, `owner_id`, `decision_maker_id`, `backup_decision_maker_id`, `blind_mode` (false), `min_evaluations` (2), `feedback_days` (aday bitiş ekranındaki tarihli söz), `candidate_contact_email`, `closed_at` |
| `hiring_opening_members` | opening, user, `role` (`EVALUATOR`) | Alımın varsayılan paneli |
| `hiring_assignments` | `assessment_id`, user | Davette paneldan kopyalanır, sonra düzenlenebilir. "Bana atanmış" sorgularının kaynağı |
| `hiring_decision_reasons` | org, `label` I18n, `kind` (`COMPETENCY_LOW`,`COMPETENCY_STRONG`,`PROCESS`), `competency_id` null, archived | Org ayarı, UX 3.10 varsayılanları seed'lenir |

### 2.2 Değerlendirme sürümü (kurucu)

Bir alımın tek değerlendirmesi var, sürümleri otomatik: yayınla = kilitle, düzenle = yeni taslak.

| Tablo | Kolonlar |
|---|---|
| `hiring_versions` | opening, `version_number`, `status` (`DRAFT`,`PUBLISHED`), `default_locale`, `locale_set`, intro başlık/gövde I18n, `consent_text_id`, `proctor_level` (`OFF`,`BASIC`,`STANDARD`,`STRICT`; varsayılan `BASIC`), `practice_enabled` (true), `scorecard` jsonb (2.3), `published_at`, `published_by` |
| `hiring_stages` | version, order, ad/açıklama I18n, `internal_purpose`, `duration_seconds`, `grace_seconds`, `on_timeout`, `back_navigation` (false) |
| `hiring_activities` | stage, order, `type` (`VIDEO`,`AUDIO`,`LONG_TEXT`,`SHORT_TEXT`,`SINGLE_CHOICE`,`MULTI_CHOICE`,`FILE_UPLOAD`), required, aday metni I18n, iç alanlar (`internal_question`, `expected_behaviours`, `red_flags`, `manager_notes`), `answer_examples` jsonb `{1,3,5}` (UX 3.1 "iyi cevap örnekleri"), `think_seconds`, `flexible_think` (true: süre bitince kayıt kendiliğinden başlamaz), `answer_seconds`, `max_takes` (2 = 1 tekrar çekim), `config` jsonb (eski `ActivityConfig`: seçenekler ve doğru cevap, karakter sınırları, dosya türleri, `textAlternativeEnabled`) |
| `hiring_activity_competencies` | activity, competency, order | En fazla 2 (CHECK + uygulama kontrolü). Seçmeli sorular yetkinlik almaz, bilgi skoruna gider |

Değişmezlik: `PUBLISHED` bir sürüm ve altındaki aşama/aktivite/eşleme satırları tetikleyiciyle
kilitlidir (eski `0001_immutability.sql`in `hiring_` tablolarına uyarlanmış hali, sürümlü göç
dosyasında).

Yayın kapısı (sunucu, `publishVersion`): her aktivite en az bir yetkinlik ölçer (seçmeli hariç),
her kullanılan yetkinliğin 1/3/5 çapası dolu, seçmeli sorunun doğru cevabı var, en az bir aşama.
Eksik varsa yayın reddedilir ve neden listesi döner (UX R2: "Yayınla" nedenli kapalı).

### 2.3 Puan kartı anlık görüntüsü

`hiring_versions.scorecard` yayın anında yazılır ve bir daha değişmez:

```ts
type ScorecardSnapshot = {
  scale: { min: number; max: number; levels: Array<{ value: number; label: I18nText }> };
  competencies: Array<{
    id: string;                       // kütüphane id'si, sadece iz için
    name: I18nText;
    anchors: Record<number, I18nText>; // 1..5, 2 ve 4 boş olabilir
    tags: Array<{ id: string; polarity: "POSITIVE" | "NEGATIVE"; label: I18nText }>;
    weight: number;                   // pozisyon profilinden ya da alımda düzenlenmiş, 0-100
  }>;
  weightsEnabled: boolean;            // kapalıysa düz ortalama
};
```

Puanlama ekranı çapaları ve etiketleri **her zaman bu görüntüden** okur, kütüphaneden değil.

Ağırlık değişikliği yayından sonra (eski kural aynen): `hiring_weight_sets` (version, label,
`is_active`, created) + `hiring_weights` (set, competency_id, percentage). Yayındaki ilk set
scorecard'dan oluşturulur. Yeni set eklemek verilmiş puanları değiştirmez (UX R10); genel puan
gösterilirken hangi setle hesaplandığı yazılır.

### 2.4 Davet, deneme, cevap

| Tablo | Kolonlar |
|---|---|
| `hiring_assessments` | `assessment_id` (PK, FK çekirdek), opening, version, `extra_time_pct` (0/25/50, aday seçer), `extra_time_chosen_at`, `candidate_status_visible_at`, `candidate_status_note` |
| `hiring_stage_runs` | attempt, stage, order, `started_at`, `deadline_at`, `submitted_at`, `last_heartbeat_at`, `completion`, `was_late`, `carried_from_stage_run_id` |
| `hiring_responses` | stage_run, activity, `payload` jsonb (eski `ResponsePayload`), `media_asset_id` (çekirdek `media_assets`), `file_asset_ids`, `takes_used`, `used_text_alternative`, `auto_score` (yalnız seçmeli, 0..1), `answered_at` |
| `hiring_retake_requests` | assessment, `scope_stage_ids` (boş = tümü), `reason` (zorunlu), `candidate_message`, `requested_by`, `resulting_attempt_id` |

- Süre sunucudadır: `deadline_at = started_at + duration × (1 + extra_time_pct/100)`, aşama
  başlarken bir kez yazılır (sınavdaki değişmezle aynı). Yenileme süreyi ne sıfırlar ne uzatır (UX A8).
- Ek süre değerlendiricilere gösterilmez (UX A6): `extra_time_pct` hiçbir panel yükleyicisinde
  seçilmez, yalnızca alım sahibi "uyarlamalar" satırında görür.
- Isınma sorusu sunucuya hiçbir şey göndermez (UX A4): ayrı rota, kayıt sadece tarayıcıda.
- Tekrar: aynı davette yeni `attempt` (çekirdek `attempt_number`), kapsam dışı aşamalar
  `carried_from_stage_run_id` ile taşınır, eski deneme silinmez, yeni deneme kendiliğinden
  birincil olmaz (UX R11). Link durumu `RETAKE_AVAILABLE`.

### 2.5 Değerlendirme ve karar

| Tablo | Kolonlar |
|---|---|
| `hiring_evaluations` | attempt, evaluator, `weight_set_id`, `submitted_at`, `updated_at`; tekil (attempt, evaluator) |
| `hiring_scores` | evaluation, activity, competency_id (scorecard'daki), `value` (1-5, null), `no_evidence` (bool), `tag_ids` jsonb, `note`, `updated_at`; tekil (evaluation, activity, competency); CHECK: `value` ile `no_evidence` aynı anda dolu olamaz |
| `hiring_score_revisions` | score, value, no_evidence, tag_ids, note, `changed_by`, `at`, `after_submit` (bool), `reason` (gönderim sonrası zorunlu; "Kalibrasyon sonrası" hazır değer) |
| `hiring_activity_notes` | evaluation, activity, body | Soru notu (aşama notu kalktı) |
| `hiring_decisions` | assessment, `status` (`ADVANCE`,`HOLD`,`DECLINE`), `reason_ids` jsonb (en az 1), `note`, `overrode_min_evaluations` (bool, true ise not zorunlu), `overall_at_decision`, `opening_median_at_decision`, `decided_by`, `at` | Her değişiklik yeni satır |

Gönderim kuralları (sunucu, `submitEvaluation`): ölçülen her (aktivite, yetkinlik) için ya
`value` ya `no_evidence` dolu; `value` 1 ya da 5 ise en az bir etiket ya da boş olmayan not
(UX 3.4). Eksikse gönderim reddedilir, satır listesi döner.

Karar kuralları (sunucu, `recordDecision`): kullanıcı alımın karar vereni ya da yedeği olmalı;
kendisi o adayın değerlendiricisiyse önce kendi değerlendirmesini göndermiş olmalı; gönderilmiş
değerlendirme sayısı `min_evaluations` altındaysa `overrode_min_evaluations = true` ve not zorunlu;
en az bir gerekçe zorunlu (UX R9). Her karar `audit_logs`'a yazılır.

## 3. Birleştirme (saf fonksiyonlar, `src/solutions/hiring/scoring.ts`)

UX 3.6 aynen, eski `scoring.ts`'den taşınır ve genişletilir:

1. Değerlendirici içi yetkinlik puanı = o değerlendiricinin o yetkinliğe verdiği `value`'ların
   ortalaması; `no_evidence` hariç.
2. Birleşik yetkinlik = değerlendirici puanlarının ortalaması, `n` ve `[min, max]` ile.
3. Genel puan = birleşik yetkinliklerin ortalaması; ağırlık açıksa ağırlıklı, puansız yetkinliğin
   ağırlığı düşülüp yeniden normalize edilir (eski `weightedScore`).
4. Bilgi skoru = seçmeli soruların `auto_score` ortalaması, ayrı satır, genel puana karışmaz.
5. Ayrışma: aynı yetkinlikte iki değerlendirici arasında fark ≥ 2, ya da biri "kanıt yok" diğeri ≥ 4.
6. Değerlendirici eğilimi: ≥ 5 ortak aday sonrası kişinin ortalaması eksi panel ortalaması;
   yalnızca karar veren ve Owner görür.
7. Gösterim tek ondalık; sıralamada `submitted` değerlendirmesi `min_evaluations` altında olan
   aday ayrı grupta, sıralamaya girmez (UX R7).

Bu dosya veritabanı bilmez; girdi düz diziler, çıktı düz nesneler. Testlerin çoğu buradadır.

## 4. Bağımsızlık kuralı (tek kapı)

UX 3.5'teki tablo `src/solutions/hiring/server/visibility.ts` içinde **tek fonksiyon**dur:

```ts
type Viewer = { userId: string; orgRole: "OWNER" | "MANAGER" | "REVIEWER" };
type CandidateVisibility = {
  othersEvaluations: boolean;   // başkalarının puanları, notları
  aggregate: boolean;           // birleşik, genel puan, ayrışma
  integrity: boolean;           // gözetim özeti ve olayları
  decisionPanel: boolean;       // karar rayı
  identity: boolean;            // blind_mode açıkken ad/iletişim
};
function visibilityFor(viewer, assessmentFacts): CandidateVisibility;
```

Kurallar: değerlendirici ve gönderim yok → ilk üçü `false`; karar veren değerlendirici değilse
→ hepsi `true`; karar veren aynı zamanda değerlendiriciyse ve göndermediyse → `decisionPanel`
görünür ama kayıt kapalı ("Önce kendi değerlendirmeni gönder."); Owner atanmamışsa her şey,
puanlamaya başladığı an değerlendirici kuralına girer. `identity`: `blind_mode` açıksa kendi
değerlendirmesini gönderene kadar `false`.

Her işe alım panel yükleyicisi (aday detayı, inceleme, karşılaştırma, Bugün satırları, aday
listesi) veriyi bu fonksiyonun çıktısına göre **sorguda** keser; istemcide gizlemek yasak (UX R1).
Gönderimden önce bütünlüğü açan kullanıcı için `audit_logs`'a `INTEGRITY_REVEALED_EARLY` yazılır
(UX 7.3).

## 5. Gözetim (sub-project 4)

- `src/lib/proctor/policy.ts`'e `BASIC` preset eklenir: kamera, tam ekran, ekran paylaşımı kapalı;
  `clipboardBlock: false`; sekme/pencere, yapıştırma ve ikinci sekme olayları kaydedilir.
- İşe alım manifest'inin `proctorPolicy(assessmentId)` fonksiyonu sürümün `proctor_level`'ını
  preset'e çevirir. `OFF` yalnızca teknik kayıt.
- İşe alımda **otomatik sonlandırma yok**, hiçbir seviyede: preset'lerde termination kuralları
  işe alım için boş döner ve testle sabitlenir (UX R13).
- Video cevap kaydı sırasında ayrıca kamera karesi alınmaz.
- Olaylar `segment_kind = 'stage_run'`, `segment_run_id = hiring_stage_runs.id` ile yazılır.

## 6. AI

`ai_runs.purpose` değerleri: `HIRING_DRAFT` (ilan metninden değerlendirme taslağı),
`ANCHOR_DRAFT`, `QUESTION_CHECK`, `NOTES_SUMMARY` (yalnızca gönderilmiş değerlendirmelerin
puan/etiket/notu, video ve transkript girmez), `CANDIDATE_NOTE_DRAFT`. Puanlama, sıralama, karar
önerisi, duygu/kişilik için **değer yoktur** (UX 3.9, R12). Transkripsiyon çekirdek işidir
(ElevenLabs Scribe, mevcut kuyruk). Model: Gemini (mevcut `src/lib/ai.ts`).

## 7. Aday API (`/api/c/[token]/hiring/*`)

`state`, `practice` yok (sunucuya gitmez), `stage/start`, `stage/heartbeat`, `stage/submit`,
`response` (autosave + commit), `extra-time`, `status` (bitişten sonra durum satırı). Medya ve
gözetim çekirdek uçlarını kullanır. Her uç önce `assessment.solution = 'HIRING'` kontrol eder.
Adaya giden her gövde `candidateSafe` benzeri bir süzgeçten geçer: iç alanlar (`internal_*`,
`expected_behaviours`, `red_flags`, `answer_examples`, seçmeli sorunun doğru cevabı, yetkinlik
eşlemesi) asla çıkmaz; sınavdaki 95 durumlu sızıntı taramasının işe alım karşılığı yazılır.

## 8. Test ve kabul

- Birim: `scoring.ts` (birleştirme, ayrışma, ağırlık, kanıt yok, eğilim), `visibility.ts`
  (UX 3.5 tablosunun her satırı), yayın kapısı, gönderim kuralları, karar kuralları,
  süre hesabı (ek süre dahil), tekrar kapsamı.
- Uçtan uca: `pnpm verify:hiring` (yeni, `verify:exam` kalıbında): alım kur, yayınla, davet et,
  aday akışı (video yerine yazılı yol dahil), iki değerlendirici, gönderimden önce ağ yanıtında
  diğerinin puanı yok, ayrışma, karar, tekrar, sızıntı taraması, çapraz çözüm 404.
- Gerçek tarayıcı (Claude in Chrome; kamera/video gerçek cihazda kullanıcıyla).
- Son tur: UX 2.1 "Kademe bunu geçmeli" listesi (A1-A12, R1-R15, E1-E5), her madde için kanıt
  ya da "doğrulanmadı". Pilot hedefleri (A12, R15) gerçek kullanıcı ister, ölçülmeden geçti denmez.

## 9. Uygulama planları (sırayla)

1. `hiring-library-openings`: kütüphane tabloları ve ekranları, alım, ekip, kurucu, puan kartı,
   AI taslağı, önizleme, yayın kapısı.
2. `hiring-candidate-flow`: davet, aday ekranları (karşılama, bilgi, kontrol, ısınma, aşama,
   aktiviteler, kopma, bitiş, durum), aday API, sızıntı taraması.
3. `hiring-review-decision`: inceleme ve puanlama, bağımsızlık kapısı, birleştirme, aday detayı,
   karşılaştırma, ayrışma/kalibrasyon, karar, tekrar, Bugün entegrasyonu.
4. `hiring-proctoring`: `BASIC` preset, seviyeler, adaya anlatım, inceleyiciye gizli bütünlük.

Her plan kendi testleriyle biter; bir sonrakine geçmeden tsc, eslint, test, build temiz olur.

## 10. Kapsam dışı (UX 9 ile aynı, özet)

E-posta gönderimi (link kopyalanır, mevcut `message_outbox`), ATS entegrasyonu, demografi
toplama ve 4/5 analizi, AI puanlama veya sıralama, kurum başına çözüm aç/kapa.
