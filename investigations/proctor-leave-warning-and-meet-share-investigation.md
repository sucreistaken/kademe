# Investigation: Yanlış "sınavdan ayrıldınız" uyarısı ve Meet'te eşzamanlı ekran paylaşımı

## Hand-off Brief

1. **Ne oldu.** Yanlış "Sınav sekmesinden ayrıldınız" uyarısının ana sebebi bulundu ve Chrome'da gösterildi: pencere `blur` dinleyicisi capture aşamasındaydı, sayfa içinde bir alanın odağı bırakması "pencereden ayrılma" sayılıyordu. Meet'te eşzamanlı ekran paylaşımı ise tarayıcıdan tespit edilemez (API yok).
2. **Durum.** Concluded (B), A için sınırlı önlemler: düzeltme `platform/solutions` dalında, testli, yerelde sahte medyayla denendi, canlıya çıkmadı.
3. **Sıradaki.** Gerçek cihazda bir kez: Meet'te tüm ekranı paylaş, sonra sınavda paylaş; kayıtta Meet'in paylaşım çubuğu görünüyor mu (görünüyorsa periyodik ekran taraması anlamlı olur).

## Case Info

| Field            | Value |
| ---------------- | ----- |
| Ticket           | N/A |
| Date opened      | 2026-10-19 |
| Status           | Concluded (B), A: limits documented |
| System           | Kademe, desktop Chrome/Edge, `platform/solutions` @ 63c9202; canlı: main |
| Evidence sources | Kaynak kod, docs/PROCTORING.md, kullanıcı gözlemi; üretim olay kayıtları ve kayıt videosu henüz yok |

## Problem Statement

Kullanıcının sözü (aynen): "meette ekran açıkken aynı anda bu adam buradada ekran açtı ve kopya cekme sistemi
düzgün oldugunu sanmıyorum bazen ekrandan cıkmaya calısmazken bile ekrandan ayrılıyorsnuz mesajı veriyor".

İki ayrı iddia:
- A. Öğrenci Meet'te ekran paylaşırken Kademe'de de ekran paylaşabildi; sistem fark etmedi.
- B. Öğrenci sınavdan çıkmadığı halde "Sınav sekmesinden ayrıldınız" uyarısı çıkıyor.

## Evidence Inventory

| Source | Status | Notes |
| ------ | ------ | ----- |
| Gözetim motoru | Available | `src/lib/client/proctor/engine.ts` (1171 satır) |
| Uyarı kuralları | Available | `src/lib/proctor/cheat-warning.ts` |
| Gözetim belgesi | Available | `docs/PROCTORING.md` |
| Üretim olay kayıtları (bu öğrenci) | Missing | `proctor_events`, üretim DB; okumak için kullanıcı izni gerekiyor |
| Sınav kaydı (kamera + ekran) | Missing | Panel > Bütünlük > "Sınavın kaydı"; Meet paylaşım çubuğu ekranda görünüyor mu |
| Öğrencinin cihazı | Missing | macOS/Windows, Meet tarayıcıda mı ayrı pencerede mi |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Üretimde bu öğrencinin TAB_HIDDEN / FOCUS_LOST olayları: süre, sıra, yanlarında hangi olay var | High | Open | Hipotez 2-5'i ayırır |
| 2 | Ekran kaydında Meet'in "ekranınızı paylaşıyor" çubuğu görünüyor mu | High | Open | Hipotez 6 (A için tek tespit yolu) |
| 3 | Kurtarma (paylaşımı yeniden aç) sırasında seçici penceresi blur üretiyor mu, gerçek Chrome'da | Medium | Open | Otomasyon seçiciyi açamaz; elle denenmeli |
| 4 | Ekran kararması / uyku `visibilitychange` üretiyor mu (macOS Chrome) | Medium | Open | Wake Lock kullanılmıyor |

## Timeline of Events

| Time | Event | Source | Confidence |
| ---- | ----- | ------ | ---------- |
| ? | Öğrenci Meet'te ve Kademe'de aynı anda ekran paylaştı | Kullanıcı | Kullanıcı gözlemi |

## Confirmed Findings

### Finding 1: Bir sekmeden ayrılma iki olaydan da aynı uyarıyı üretiyor

**Evidence:** `src/lib/proctor/cheat-warning.ts:47-49`, `src/lib/client/proctor/engine.ts:930-955`

**Detail:** `TAB_HIDDEN` (`visibilitychange`) ve `FOCUS_LOST` (pencere `blur`, 2 sn sonra) ikisi de `LEFT_EXAM`
uyarısına bağlı. Yani sekme gizlenmeden, sadece pencere odağı 2 sn'den uzun giderse de "Sınav sekmesinden
ayrıldınız" yazıyor. Odağı ne aldığı kaydedilmiyor.

### Finding 2: Uyarılar yalnız ısınma bölümünde susturuluyor

**Evidence:** `src/lib/client/proctor/engine.ts:378`, `src/components/candidate/exam/ExamRunner.tsx:260`

**Detail:** `warnSuppressors` tek çağrı yerinden doluyor: ısınma ("warmup"). Sınav içindeki kurtarma akışları
(ekran paylaşımını yeniden açma `ExamRunner.tsx:1049`, tam ekrana dönme `:1050`) korumayı (guarding) açık bırakıyor.

### Finding 3: Ekran uyku kilidi (Wake Lock) kullanılmıyor

**Evidence:** `grep -rn wakeLock src` boş.

### Finding 4: Blur zamanlayıcısı tek değişkende tutuluyor

**Evidence:** `src/lib/client/proctor/engine.ts:941-951`

**Detail:** Araya `focus` girmeden iki `blur` gelirse ilk zamanlayıcı kaybolur, iptal edilemez; odak geri geldikten sonra
`FOCUS_LOST` başlar ve uyarı bir sonraki odak olayında, öğrenci hiçbir şey yapmamışken çıkar.

### Finding 5: Başka bir uygulamanın ekran paylaşımını görecek bir sinyal yok

**Evidence:** `docs/PROCTORING.md` sinyal tablosu; `engine.ts:642-695` yalnız kendi `getDisplayMedia` akışını doğruluyor.

**Detail:** Kademe kendi paylaşımının "tüm ekran" olduğunu doğruluyor; aynı ekranın başka bir uygulamaya (Meet,
Zoom) da paylaşıldığını bilen bir kontrol yok. Belge sistemi "caydırıcı ve kanıt toplayıcı, kurcalamaya dayanıklı
değil" diye tanımlıyor.

## Deduced Conclusions

### Deduction 1: Ekranı kendisi paylaşıp yardım alan biri, sekmeden çıkmadan sınavı bitirebilir

**Based on:** Finding 5, Finding 1

**Reasoning:** Meet paylaşımı arka planda sürer; sınav sekmesi tam ekranda ve odakta kalır. Ne `visibilitychange`
ne `blur` tetiklenir. Yardımcı kulaklıktan konuşursa ses algılama da duymaz (yalnız mikrofon).

**Conclusion:** A iddiası doğru: bugünkü sistem bunu yakalamaz. Tarayıcıdan doğrudan tespit edilebileceğine dair bir
API bilmiyorum (doğrulanacak, bkz. Hipotez 6 ve 7).

## Hypothesized Paths

### Hypothesis 1: (Kullanıcının) Kopya sistemi düzgün çalışmıyor

**Status:** Open

**Theory:** Kullanıcının genel iddiası; aşağıdaki iki somut parçaya bölündü (A: Hipotez 6-7, B: Hipotez 2-5).

**Resolution:** -

### Hipotez 2: Kurtarma akışı kendi uyarısını üretiyor

**Status:** Open

**Theory:** Sınav sırasında paylaşım durur, öğrenci "yeniden paylaş"a basar; Chrome'un seçici penceresi odağı alır,
öğrenci seçim yaparken 2 sn geçer, `FOCUS_LOST` başlar; seçici kapanınca `focus` gelir ve "ayrıldınız" uyarısı açılır.

**Supporting indicators:** Finding 2; seçicide seçim 2 sn'den uzun sürer.

**Would confirm:** Üretim olaylarında `SCREEN_SHARE_STOPPED` bitişinin hemen yanında bir `FOCUS_LOST`; ya da gerçek
Chrome'da elle deneme.

**Would refute:** Seçici açıkken pencerenin `blur` almadığının gerçek Chrome'da görülmesi.

**Resolution:** -

### Hipotez 3: Ekran kararması / uyku sekmeyi "gizli" yapıyor

**Status:** Open

**Theory:** Uzun okuma ya da dinleme sırasında fare/klavye kullanılmayınca dizüstü ekran uyur; `document.hidden` true
olur, `TAB_HIDDEN` başlar, öğrenci dokununca uyarı çıkar.

**Supporting indicators:** Finding 3.

**Would confirm:** Üretimde, öncesinde uzun süre `keydown` olmayan, dakikalarca süren `TAB_HIDDEN`; ekran kaydında o
aralıkta değişmeyen sınav ekranı.

**Would refute:** Etkin bir ekran yakalamanın Chrome'da ekran uykusunu zaten engellediğinin gösterilmesi.

**Resolution:** -

### Hipotez 4: Sınav dışı ama zararsız odak kaybı (bildirim, izin balonu, Chrome çubuğu)

**Status:** Open

**Theory:** Bir sistem bildirimi, Chrome'un çeviri balonu (içerik Almanca), paylaşım çubuğu ya da başka bir uygulamanın
üstte kalan penceresi odağı 2 sn'den uzun alıyor; sekme gizlenmiyor ama `FOCUS_LOST` uyarısı çıkıyor.

**Supporting indicators:** Finding 1 (yalnız blur yetiyor).

**Would confirm:** Üretimde yanında `TAB_HIDDEN` olmayan, kısa (2-10 sn) `FOCUS_LOST` olayları; ekran kaydında sınav
ekranı değişmeden kalıyor.

**Would refute:** Yanlış uyarıların hepsinin `TAB_HIDDEN` ile birlikte gelmesi.

**Resolution:** -

### Hipotez 5: Kaybolan blur zamanlayıcısı

**Status:** Open

**Theory:** Finding 4: art arda iki blur sonrası, öğrenci geri döndükten sonra `FOCUS_LOST` açılıyor.

**Would confirm:** `FOCUS_LOST` başlangıcının, önceki `focus` anından sonra olduğu bir olay; birim testiyle tekrar.

**Resolution:** -

### Hipotez 6: Meet paylaşımı kendi ekran kaydımızda görünüyor

**Status:** Open

**Theory:** Chrome, her ekran yakalama için "X ekranınızı paylaşıyor" çubuğu gösterir; macOS ayrıca menü çubuğunda
kayıt göstergesi. Bunlar Kademe'nin ekran karesinde görünüyorsa öğretmen kayıtta görür ve AI ikinci bakışa sorulabilir.

**Would confirm:** Bu öğrencinin ekran kaydında ikinci bir paylaşım çubuğu.

**Would refute:** Chrome'un kendi paylaşım çubuğunu yakalamadan dışladığının görülmesi.

**Resolution:** -

### Hipotez 7: Tarayıcı içinden başka bir yakalamayı görmek mümkün

**Status:** Open

**Theory:** Bir web sayfasının, ekranının başka bir uygulama tarafından yakalandığını öğrenebileceği bir API var.

**Would confirm:** Chrome belgelerinde böyle bir API. (Capture Handle yalnız sekme yakalamada, yakalayana bilgi verir;
bu iş için uymadığını sanıyorum, doğrulamadım.)

**Resolution:** -

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| Bu öğrencinin üretim olayları | Hipotez 2-5'i ayırır | Üretim DB'de `proctor_events` sorgusu (kullanıcı izniyle) |
| Bu öğrencinin ekran kaydı | Hipotez 6 | Panel > öğrenci > Bütünlük > Sınavın kaydı |
| Cihaz ve Meet'in nerede açık olduğu | A'nın senaryosu | Kullanıcıya sor |

## Source Code Trace

| Element | Detail |
| ------- | ------ |
| Error origin | `src/lib/client/proctor/engine.ts:930-955` (visibilitychange + blur), `src/lib/proctor/cheat-warning.ts:47` |
| Trigger | `engine.arm()` (`engine.ts:882`) sistem kontrolünden sonra; sınav boyunca açık |
| Condition | Pencere odağı > 2 sn gider ya da sekme gizlenir |
| Related files | `src/components/candidate/exam/ExamRunner.tsx` (RecoverPanel), `src/components/candidate/proctor/CheatWarning.tsx`, `src/i18n/messages/candidate.tr.json:1206` |

## Conclusion

**Confidence:** High for B's main cause (deterministic repro in Chrome), Medium for the secondary causes, Low for any detection of A.

B: Confirmed root cause: `engine.ts` registered `window` `blur`/`focus` with `capture = true`, so an element losing focus
inside the page (textarea -> reading text, option -> empty area) started `FOCUS_LOST` after 2 s and the next focus inside
the page raised LEFT_EXAM. Secondary (Deduced, fixed defensively): our own prompts (screen picker on recovery, fullscreen),
display sleep (no Wake Lock), the lost blur timer, and focus taken with no student input.

A: No web API tells a page that another app captures the screen (Capture Handle informs only the capturer, confirmed in
Chrome docs). Mitigations: rule line for students, echo cancellation off on the proctor mic (it removed speaker audio,
a caller's voice included), AI second look counts a second sharing bar or call UI as non-exam content.

## Recommended Next Steps

### Fix direction

Done in `src/lib/proctor/leave-detector.ts` (+16 tests) and `src/lib/client/proctor/engine.ts`; see Follow-up.

### Diagnostic

- Real device: Meet whole-screen share + exam share; check the recording for two sharing bars.
- Real device: stop the share from Chrome's bar during the exam, re-share with the picker open for 5 s: expect no warning.
- Production events of the reported student were not read (needs permission); new `meta.inputGapMs` makes future cases readable.

## Reproduction Plan

Gerçek Chrome, gerçek ekran paylaşımı ile: sınava gir, paylaşımı Chrome çubuğundan durdur, "yeniden paylaş"a bas,
seçicide 3-4 sn bekle, seç. Uyarı çıkıyorsa Hipotez 2 doğrulanır. (Otomasyon seçiciyi açamaz; elle.)

## Side Findings

- Gözetim yalnız sınav akışında (`src/app/a/[token]/layout.tsx`); işe alım akışında yok.

## Follow-up: 2026-10-19

### New Evidence

- Chrome test page (old vs new listener logic, real clicks): textarea -> click reading text -> wait 3 s -> click an
  option. Old logic: "OLD capture blur target=box", "OLD FOCUS_LOST begins", "OLD WARNING". New logic: nothing;
  `document.hasFocus()` stayed true.
- Local exam with `PROCTOR_DEV_FAKE=1` (shell only, server stopped after): the same click sequence on a grammar item
  produced no event and no warning; Wake Lock held; a fed hide after input raised the warning and stored
  `{"inputGapMs":0,"warned":true}`; a hide 60 s after the last input stored `{"inputGapMs":60000}` with no warning.
- During that run a real `TAB_HIDDEN` arrived with no input for 105 s (window covered or display going off, cause not
  verified); it was recorded and closed without a warning.
- Research (web): Capture Handle does not tell the captured page; `<meta name="google" content="notranslate">` turns off
  Chrome's translate offer; Wake Lock is released on hide and must be re-requested; echo cancellation removes speaker
  output from the microphone.

### Updated Hypotheses

- Hypothesis 1 (user): Confirmed for B (the system did misfire), Confirmed for A (it cannot see Meet).
- Hipotez 2 (own prompt): Open on real devices, handled by `prompting()` grace either way.
- Hipotez 3 (display sleep): Open, handled by Wake Lock and the input-gap rule.
- Hipotez 4 (focus thieves): Open, handled by the input-gap rule.
- Hipotez 5 (lost blur timer): Confirmed in code, replaced by the tick-driven detector (test "a second blur...").
- Hipotez 6 (Meet bar in our frames): Open, needs one manual test.
- Hipotez 7 (web API for concurrent capture): Refuted (Capture Handle informs the capturer only).
- New, Confirmed: capture-phase `blur` on `window` counted in-page focus moves as leaving (root cause of B).

### Updated Conclusion

See Conclusion above.

