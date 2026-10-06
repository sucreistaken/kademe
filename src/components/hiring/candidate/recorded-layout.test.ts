import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { messagesFor } from "@/i18n/candidate";
import type { Locale } from "@/i18n/locale";
import { Practice } from "./practice";
import { RecordedActivity, type RecordedProps } from "./recorded-activity";

/**
 * HIRING-VISUAL-FLOW 3.4, 3.8 (Task 9): the first paint of the warm-up and of a
 * recorded answer, rendered without a browser. What a real camera, a ring that
 * runs and the footer's placement do is checked on a real device.
 */
const Provider = NextIntlClientProvider as unknown as (props: { locale: string; messages: unknown; timeZone: string }) => ReactNode;
const wrap = (locale: Locale, child: ReactNode) => renderToStaticMarkup(createElement(Provider, { locale, messages: messagesFor(locale), timeZone: "Europe/Istanbul" }, child));

const activity: RecordedProps["activity"] = {
  id: "q1",
  type: "VIDEO",
  prompt: { tr: "Kendini tanıt.", en: "Introduce yourself." },
  note: { tr: "", en: "" },
  thinkSeconds: 30,
  flexibleThink: true,
  answerSeconds: 120,
  maxTakes: 2,
  textAlternativeEnabled: false,
};

const recorded = (over: Partial<RecordedProps> = {}, locale: Locale = "tr") =>
  wrap(
    locale,
    createElement(RecordedActivity, {
      mode: "answer",
      activity,
      locale,
      headingRef: null,
      sink: { open: async () => Promise.reject(new Error("no network in a render")) },
      takesUsed: 0,
      existingRef: null,
      playbackSrc: async () => null,
      timeUp: false,
      disabled: false,
      ...over,
    }),
  );

describe("the warm-up's first paint", () => {
  const html = wrap("tr", createElement(Practice, { token: "tok", camera: true, locale: "tr" }));

  it("shows the chip, the question, the think ring, the picture's place and the notes row", () => {
    expect(html).toContain("Isınma · kimse görmez");
    expect(html).toContain("Bugün nasıl geçti, kısaca anlat.");
    expect(html).toContain("Düşünme süren 0:15");
    expect(html).toContain("düşünme");
    expect(html).toContain("Kamera, sen başlatınca açılır.");
    expect(html).toContain("Not al");
    expect(html).not.toContain("tekrar hakkın");
  });

  it("puts the journey, the way out on the left and the one filled button in the footer", () => {
    expect(html).toContain("Isınma · Bölüm 3 / 4");
    expect(html).toContain("Isınmayı atla");
    expect(html).toContain('href="/a/tok/stage/1"');
    expect(html).toContain("Kaydı başlat");
    expect(html.match(/id="record-start"/g)).toHaveLength(1);
    expect(html).not.toContain("Hazırım, değerlendirmeye başla");
  });

  it("an audio warm-up says the microphone opens later, in English too", () => {
    const audio = wrap("en", createElement(Practice, { token: "tok", camera: false, locale: "en" }));
    expect(audio).toContain("The microphone opens when you start.");
    expect(audio).toContain("Warm-up · nobody sees it");
    expect(audio).toContain("Thinking time 0:15");
  });
});

describe("a recorded answer's first paint", () => {
  it("names the kind and the takes in the chip, rings the think time and starts from the footer", () => {
    const html = recorded();
    expect(html).toContain("Video cevabı · Bir tekrar hakkın var");
    expect(html).toContain("Düşünme süren 0:30");
    expect(html).toContain("Kaydı başlat");
    expect(html).not.toContain('id="record-use"');
  });

  it("C4: time up makes the start button wait with its reason, never a spinner", () => {
    const html = recorded({ timeUp: true, disabled: true });
    expect(html).toContain("Süre doldu; yeni kayıt başlatılamaz.");
    expect(html).toContain('id="record-start-why"');
    expect(html).not.toContain("Kaydediliyor");
  });

  it("C4: while the runner works (not time up) the start button is the busy one and says Kaydediliyor", () => {
    const html = recorded({ timeUp: false, disabled: true });
    expect(html).toContain("Kaydediliyor");
    expect(html).not.toContain("record-start-why");
  });

  it("C4: during the send strip the runner's reason stands next to the button, with no spinner", () => {
    const html = recorded({ timeUp: false, disabled: true, holdReason: "Gönderiliyor. Vazgeçersen Geri al'a bas." });
    expect(html).toContain("Gönderiliyor. Vazgeçersen Geri al&#x27;a bas.");
    expect(html).not.toContain("Kaydediliyor");
  });

  it("the runner's own filled button (hidePrimary) leaves no footer here", () => {
    const html = recorded({ hidePrimary: true });
    expect(html).not.toContain("data-step-footer");
    expect(html).toContain("Kendini tanıt.");
  });

  it("opens on the review of the newest take after a reload, with 'Bu cevabı kullan' filled and 'Tekrar çek' beside it", () => {
    const html = recorded({ existingRef: "take-1", takesUsed: 1, existingStatus: "READY" });
    expect(html).toContain("Kaydını izle");
    expect(html).toContain('id="record-use"');
    expect(html).toContain("Bu cevabı kullan");
    expect(html).toContain("Tekrar çek");
  });

  it("time up on a review: no retake is offered and 'Bu cevabı kullan' waits with the reason", () => {
    const html = recorded({ existingRef: "take-1", takesUsed: 1, existingStatus: "READY", timeUp: true, disabled: true });
    expect(html).not.toContain('id="record-retake"');
    expect(html).toContain("Süre doldu; yeni kayıt başlatılamaz.");
    expect(html).not.toContain("Kaydediliyor");
  });

  it("fix round 1 (Important 1): during the send strip a review has no spinner anywhere, Tekrar çek is not offered, the runner's reason stands", () => {
    const html = recorded({ existingRef: "take-1", takesUsed: 1, existingStatus: "READY", timeUp: false, disabled: true, holdReason: "Gönderiliyor. Vazgeçersen Geri al'a bas." });
    expect(html).not.toContain("Kaydediliyor");
    expect(html).not.toContain('id="record-retake"');
    expect(html).toContain("Gönderiliyor. Vazgeçersen Geri al&#x27;a bas.");
    expect(html).toContain('id="record-use"');
  });

  it("fix round 1 (Minor 1): on a review, time up says what the runner does (saves by itself), not that a recording cannot start", () => {
    const html = recorded({ existingRef: "take-1", takesUsed: 1, existingStatus: "READY", timeUp: true, disabled: true });
    expect(html).toContain("Süre doldu; cevabın kendiliğinden kaydediliyor.");
    expect(html).toContain('id="record-use-why"');
    expect(html).not.toContain('id="record-retake"');
    const en = recorded({ existingRef: "take-1", takesUsed: 1, existingStatus: "READY", timeUp: true, disabled: true }, "en");
    expect(en).toContain("Time is up; your answer is saved automatically.");
  });

  it("fix round 1 (Minor 1): the written answer's send button says the same at time up, and its way back is gone", () => {
    const alternative = { node: null, ready: true, using: true, onChoose: () => undefined, send: () => undefined };
    const html = recorded({ activity: { ...activity, textAlternativeEnabled: true }, alternative, timeUp: true, disabled: true });
    expect(html).toContain("Süre doldu; cevabın kendiliğinden kaydediliyor.");
    expect(html).not.toContain("Kayıt ile cevaplamayı dene");
  });

  it("fix round 1 (Important 2): the way back from the written answer is offered only while the screen is free", () => {
    const alternative = { node: null, ready: true, using: true, onChoose: () => undefined, send: () => undefined };
    const withText = { ...activity, textAlternativeEnabled: true };
    expect(recorded({ activity: withText, alternative })).toContain("Kayıt ile cevaplamayı dene");
    expect(recorded({ activity: withText, alternative, disabled: true, holdReason: "Gönderiliyor." })).not.toContain("Kayıt ile cevaplamayı dene");
    expect(recorded({ activity: withText, alternative, disabled: true })).not.toContain("Kayıt ile cevaplamayı dene");
  });

  it("fix round 1 (Important 4): the camera line shows on the think screen only; a review's place has its icon alone", () => {
    expect(recorded()).toContain("Kamera, sen başlatınca açılır.");
    const review = recorded({ existingRef: "take-1", takesUsed: 1, existingStatus: "UPLOADING" });
    expect(review).not.toContain("Kamera, sen başlatınca açılır.");
    expect(recorded({ existingRef: "take-1", takesUsed: 1, existingStatus: "READY" })).not.toContain("Kamera, sen başlatınca açılır.");
  });

  it("fix round 1 (Minor 2): a single take reached on reload prints no 'Tekrar hakkın kalmadı' under the single-take chip", () => {
    const one = recorded({ activity: { ...activity, maxTakes: 1 }, existingRef: "take-1", takesUsed: 1, existingStatus: "READY" });
    expect(one).toContain("Tek çekim: tekrar hakkı yok.");
    expect(one).not.toContain("Tekrar hakkın kalmadı");
    const two = recorded({ existingRef: "take-1", takesUsed: 2, existingStatus: "READY" });
    expect(two).toContain("Tekrar hakkın kalmadı");
  });

  it("the written alternative's link says 'Yazarak cevaplamam gerekiyor' (audio too)", () => {
    const withText = { ...activity, textAlternativeEnabled: true };
    const alternative = { node: null, ready: false, using: false, onChoose: () => undefined, send: () => undefined };
    expect(recorded({ activity: withText, alternative })).toContain("Yazarak cevaplamam gerekiyor");
    expect(recorded({ activity: { ...withText, type: "AUDIO" }, alternative })).toContain("Yazarak cevaplamam gerekiyor");
  });
});
