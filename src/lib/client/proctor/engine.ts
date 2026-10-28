"use client";

import { candidateApiBase } from "@/lib/client/api";
import { calibrateFloor, createVad, type Vad } from "@/lib/proctor/vad-logic";
import { countPeople, createSignalTracker, type SignalTracker } from "@/lib/proctor/signals";
import { yawPitchFromMatrix } from "@/lib/proctor/head-pose";
import { verifyDisplaySurface } from "@/lib/proctor/environment";
import { ProctorRecording } from "@/lib/client/proctor/recording";
import type { RecordingActivity } from "@/lib/proctor/recording-status";
import {
  EXTENDED_POLL_MS,
  GAZE_WARNING_AFTER_MS,
  INITIAL_WARNING_STATE,
  NO_FACE_WARNING_AFTER_MS,
  delayUntilLasted,
  dismissWarning,
  extendedDecision,
  parseWarnings,
  raiseWarning,
  resolveWarning,
  secondScreenPresent,
  serializeWarnings,
  warningKindFor,
  type ActiveWarning,
  type WarningState,
} from "@/lib/proctor/cheat-warning";
import { INITIAL_LEAVE_STATE, stepLeave, type LeaveInput, type LeaveState } from "@/lib/proctor/leave-detector";
import type { ProctoringPolicy } from "@/lib/proctor/policy";
import type { ProctorEventType } from "@/lib/proctor/taxonomy";

/**
 * The browser half of proctoring, as one object that outlives page changes.
 *
 * It owns the camera and microphone, the screen share, fullscreen, the page
 * guards, the in-browser models, the frames it uploads, the event queue and
 * the heartbeat. React screens subscribe to its snapshot; nothing here renders.
 *
 * What it can see and what it cannot is in docs/PROCTORING.md. It never fails
 * a student: it reports, the server stores, a teacher decides.
 */

export const MEDIAPIPE_VERSION = "1.0.1";
const ASSETS = `/proctor/${MEDIAPIPE_VERSION}`;

export type DeviceState = "idle" | "asking" | "ok" | "denied" | "lost" | "unsupported";
export type ModelState = "off" | "loading" | "ready" | "unavailable";
export type Banner =
  | { kind: "recover"; reason: "FULLSCREEN" | "SCREEN" | "CAMERA" }
  | { kind: "act"; reason: "NO_FACE" | "VOICE" }
  | { kind: "info"; reason: "RECORDED" | "SECOND_SCREEN" };

export type EngineSnapshot = {
  ready: boolean;
  policy: ProctoringPolicy | null;
  devFake: boolean;
  camera: DeviceState;
  mic: DeviceState;
  screen: DeviceState;
  surface: "MONITOR" | "WRONG_SURFACE" | "UNVERIFIED" | null;
  fullscreen: boolean;
  isExtendedSupported: boolean;
  isExtended: boolean | null;
  model: ModelState;
  faces: number | null;
  micLevel: number;
  quietFloor: number | null;
  guarding: boolean;
  banner: Banner | null;
  terminated: boolean;
  error: string | null;
  /** What the continuous recording records right now; null when this tab does not record. */
  recording: RecordingActivity | null;
  /** The recording's upload line; null when this tab never recorded. */
  upload: { pending: number; stalled: boolean } | null;
  /** The big warning on screen right now (cheat-warning.ts); null when none. */
  warning: ActiveWarning | null;
  /** Warnings counted in this attempt so far. */
  warningCount: number;
  /** The Window Management permission (several screens): "unsupported" when the browser has no such API. */
  windowManagement: "unsupported" | "idle" | "asking" | "granted" | "denied";
};

type QueuedEvent = { clientEventId: string; type: ProctorEventType; at: number; endedAt?: number; meta?: Record<string, unknown> };

const STORE = (token: string) => `kademe-proctor-outbox-${token.slice(0, 16)}`;
/** The warning count lives in sessionStorage, so a reload of this tab keeps the number. */
const WARN_STORE = (token: string) => `kademe-proctor-warnings-${token.slice(0, 16)}`;

/** The slice of the Window Management API this file uses (Chromium). */
type ScreenDetailsLike = EventTarget & { screens: ArrayLike<unknown> };
type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetailsLike> };
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export class ProctorEngine {
  readonly token: string;
  private listeners = new Set<() => void>();
  private snap: EngineSnapshot = {
    ready: false,
    policy: null,
    devFake: false,
    camera: "idle",
    mic: "idle",
    screen: "idle",
    surface: null,
    fullscreen: false,
    isExtendedSupported: typeof window !== "undefined" && "isExtended" in window.screen,
    isExtended: null,
    model: "off",
    faces: null,
    micLevel: 0,
    quietFloor: null,
    guarding: false,
    banner: null,
    terminated: false,
    error: null,
    recording: null,
    upload: null,
    warning: null,
    warningCount: 0,
    windowManagement: "idle",
  };
  private sessionId: string | null = null;
  private clientOffsetMs = 0;
  private outbox: QueuedEvent[] = [];
  private open = new Map<string, string>();
  private timers: number[] = [];
  private cleanups: Array<() => void> = [];
  cameraStream: MediaStream | null = null;
  screenStream: MediaStream | null = null;
  private camVideo: HTMLVideoElement | null = null;
  private screenVideo: HTMLVideoElement | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vad: Vad | null = null;
  private voiceSuppressors = new Set<string>();
  private tracker: SignalTracker | null = null;
  private lastKeyAt: number | null = null;
  private visionLoop: number | null = null;
  private bannerTimer: number | null = null;
  /** The continuous recording (recording.ts); created when the exam is armed. */
  private recording: ProctorRecording | null = null;
  /** The session's answer: the policy records and the accepted consent text announces it. */
  private recordingConsented = false;
  /** Development fake-media mode only: the face count the model's result is replaced with. */
  devFaces = 1;
  private warn: WarningState = INITIAL_WARNING_STATE;
  /** Reasons the warnings are paused for (the warm-up practice), like voiceSuppressors. */
  private warnSuppressors = new Set<string>();
  /** Long signals (gaze, missing face) waiting to have lasted long enough to become a warning. */
  private longTimers = new Map<string, number>();
  /** Where each event began, so a warning count can be added to an event that was already sent. */
  private eventStart = new Map<string, number>();
  private screenDetails: ScreenDetailsLike | null = null;
  private secondScreenRaised = false;
  /** Leaving the tab or the window (leave-detector.ts). */
  private leave: LeaveState = { ...INITIAL_LEAVE_STATE };
  /** Keeps the display awake while the exam runs, so a sleeping screen is not a "left the tab". */
  private wakeLock: { release(): Promise<void>; addEventListener(type: "release", fn: () => void): void } | null = null;

  constructor(token: string) {
    this.token = token;
    try {
      this.warn = parseWarnings(sessionStorage.getItem(WARN_STORE(token)));
      this.snap = { ...this.snap, warningCount: this.warn.count, windowManagement: "getScreenDetails" in window ? "idle" : "unsupported" };
    } catch {
      this.warn = INITIAL_WARNING_STATE;
    }
    try {
      const saved = localStorage.getItem(STORE(token));
      if (saved) this.outbox = JSON.parse(saved) as QueuedEvent[];
    } catch {
      this.outbox = [];
    }
  }

  // ------------------------------------------------------------------ state

  get snapshot() {
    return this.snap;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(patch: Partial<EngineSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.listeners) fn();
  }

  private api(path: string) {
    return `${candidateApiBase(this.token)}${path}`;
  }

  private now() {
    return Date.now() + this.clientOffsetMs;
  }

  // ---------------------------------------------------------------- session

  /** Where the session began: the exam page means the tab was reloaded mid-exam. */
  startedFrom: "check" | "exam" | null = null;
  /** Whether this tab has been in fullscreen at least once (changes the wording). */
  everFullscreen = false;

  async start(env: Record<string, unknown>, from: "check" | "exam" = "check") {
    if (this.sessionId) return;
    this.startedFrom = from;
    const clientSessionId = sessionStorage.getItem("kademe-proctor-client") ?? rid();
    sessionStorage.setItem("kademe-proctor-client", clientSessionId);
    const res = await fetch(this.api("/proctor/session"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientSessionId, env }),
    });
    if (!res.ok) throw new Error(`session ${res.status}`);
    const body = (await res.json()) as { sessionId: string; policy: ProctoringPolicy; recording?: boolean; serverNow: number; devFakeMedia: boolean };
    this.sessionId = body.sessionId;
    // Absent (an older server) means no: nothing is recorded without the consent saying so.
    this.recordingConsented = body.recording === true;
    this.clientOffsetMs = body.serverNow - Date.now();
    this.set({ ready: true, policy: body.policy, devFake: body.devFakeMedia, isExtended: this.readExtended() });
    this.every(() => void this.flush(), 10_000);
    this.every(() => void this.heartbeat(), 15_000);
    this.watchSecondScreen(body.policy);
    void this.flush();
  }

  private every(fn: () => void, ms: number) {
    this.timers.push(window.setInterval(fn, ms));
  }

  private readExtended(): boolean | null {
    const s = window.screen as Screen & { isExtended?: boolean };
    return typeof s.isExtended === "boolean" ? s.isExtended : null;
  }

  private async heartbeat() {
    if (!this.sessionId) return;
    try {
      const res = await fetch(this.api("/proctor/heartbeat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          state: {
            camera: this.snap.camera,
            screen: this.snap.screen,
            fullscreen: this.snap.fullscreen,
            model: this.snap.model,
            faces: this.snap.faces,
          },
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { serverNow: number; finished?: boolean };
        this.clientOffsetMs = body.serverNow - Date.now();
      }
    } catch {
      // The server notices a silent tab by itself (HEARTBEAT_GAP).
    }
  }

  // ----------------------------------------------------------------- events

  private persist() {
    try {
      localStorage.setItem(STORE(this.token), JSON.stringify(this.outbox.slice(-200)));
    } catch {
      /* storage full or blocked: events still go out from memory */
    }
  }

  /** An event with no duration. */
  instant(type: ProctorEventType, meta?: Record<string, unknown>) {
    const id = rid();
    this.eventStart.set(id, this.now());
    this.outbox.push({ clientEventId: id, type, at: this.now(), meta });
    this.persist();
    return id;
  }

  /** Starts an interval, once per type at a time. */
  begin(type: ProctorEventType, meta?: Record<string, unknown>) {
    if (this.open.has(type)) return this.open.get(type)!;
    const id = rid();
    this.open.set(type, id);
    this.eventStart.set(id, this.now());
    this.outbox.push({ clientEventId: id, type, at: this.now(), meta });
    this.persist();
    return id;
  }

  end(type: ProctorEventType) {
    const id = this.open.get(type);
    if (!id) return;
    this.open.delete(type);
    const first = this.outbox.find((e) => e.clientEventId === id);
    this.outbox.push({ clientEventId: id, type, at: first?.at ?? this.now(), endedAt: this.now() });
    this.persist();
  }

  async flush(useBeacon = false) {
    if (!this.sessionId || this.outbox.length === 0) return;
    const batch = this.outbox.slice(0, 50);
    const body = JSON.stringify({ sessionId: this.sessionId, clientOffsetMs: 0, events: batch });
    if (useBeacon) {
      navigator.sendBeacon(this.api("/proctor/events"), new Blob([body], { type: "text/plain" }));
      this.outbox = this.outbox.slice(batch.length);
      this.persist();
      return;
    }
    try {
      const res = await fetch(this.api("/proctor/events"), { method: "POST", body, headers: { "content-type": "text/plain" } });
      if (!res.ok) return;
      this.outbox = this.outbox.slice(batch.length);
      this.persist();
      const json = (await res.json()) as { terminated?: boolean };
      if (json.terminated) this.set({ terminated: true });
    } catch {
      /* kept for the next flush */
    }
  }

  private showBanner(banner: Banner, ms?: number) {
    if (this.bannerTimer) window.clearTimeout(this.bannerTimer);
    this.set({ banner });
    if (ms) this.bannerTimer = window.setTimeout(() => this.set({ banner: null }), ms);
  }

  private clearBanner(reason: string) {
    if (this.snap.banner && "reason" in this.snap.banner && this.snap.banner.reason === reason) this.set({ banner: null });
  }

  // --------------------------------------------------------------- warnings

  /** Pauses the big warnings (the warm-up practice is not the exam). */
  suppressWarnings(reason: string, on: boolean) {
    const was = this.warnSuppressors.size > 0;
    if (on) this.warnSuppressors.add(reason);
    else this.warnSuppressors.delete(reason);
    // A second screen still connected when the practice ends must not go unmentioned.
    if (was && this.warnSuppressors.size === 0 && this.secondScreenRaised) this.warnFor("SECOND_SCREEN_DETECTED");
  }

  private publishWarnings() {
    try {
      sessionStorage.setItem(WARN_STORE(this.token), serializeWarnings(this.warn));
    } catch {
      /* the count then lives in memory only */
    }
    this.set({ warning: this.warn.open, warningCount: this.warn.count });
  }

  /** The student pressed "back to the exam". */
  acknowledgeWarning() {
    this.warn = dismissWarning(this.warn);
    this.publishWarnings();
  }

  /**
   * Adds facts to an event's meta, also when the event has already been sent
   * (the server merges meta of the same clientEventId). The panel reads the
   * warning count from here.
   */
  private annotate(eventId: string, type: ProctorEventType, meta: Record<string, unknown>) {
    const queued = this.outbox.find((e) => e.clientEventId === eventId);
    if (queued) queued.meta = { ...(queued.meta ?? {}), ...meta };
    else this.outbox.push({ clientEventId: eventId, type, at: this.eventStart.get(eventId) ?? this.now(), meta });
    this.persist();
  }

  /**
   * Raises the big warning for a recorded event when it is a serious one and
   * the rules allow (guarding, not the warm-up, not held back by the rate
   * limit). The event itself is recorded either way.
   */
  private warnFor(type: ProctorEventType, eventId?: string, detail?: { shortcutKey?: string }) {
    const kind = warningKindFor(type, detail);
    if (!kind || !this.snap.guarding || this.warnSuppressors.size > 0) return;
    const r = raiseWarning(this.warn, kind, Date.now());
    this.warn = r.state;
    if (eventId) this.annotate(eventId, type, { warningCount: r.count, warned: r.accepted });
    if (r.accepted) this.publishWarnings();
  }

  // ------------------------------------------------------------- leaving

  private feedLeave(input: LeaveInput) {
    if (!this.snap.guarding) return;
    const r = stepLeave(this.leave, input);
    this.leave = r.state;
    for (const a of r.actions) {
      if (a.do === "BEGIN") {
        const id = this.begin(a.kind, a.meta);
        // Send the event first so the frame can be tied to it on the server; a second later
        // the shared screen shows whatever was switched to.
        void this.flush().then(() => window.setTimeout(() => void this.captureScreen("VIOLATION", id), a.kind === "TAB_HIDDEN" ? 1000 : 0));
      } else {
        const id = this.open.get(a.kind);
        this.end(a.kind);
        if (id && a.warn) this.warnFor(a.kind, id);
      }
    }
  }

  /**
   * Runs one of our own prompts (the screen-share picker, fullscreen, a camera or
   * screens permission). They take the focus; leave-detector.ts does not count
   * that as leaving the exam.
   */
  private async prompting<T>(reason: string, fn: () => Promise<T>): Promise<T> {
    this.feedLeave({ type: "promptStart", t: Date.now(), reason });
    try {
      return await fn();
    } finally {
      this.feedLeave({ type: "promptEnd", t: Date.now() });
    }
  }

  /** The browser drops the lock whenever the tab is hidden; it is asked for again on return. */
  private async holdWakeLock() {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<NonNullable<ProctorEngine["wakeLock"]>> } };
    if (!this.snap.guarding || this.wakeLock || !nav.wakeLock || document.hidden) return;
    try {
      const lock = await nav.wakeLock.request("screen");
      // The exam ended while the browser was answering.
      if (!this.snap.guarding) return void lock.release().catch(() => undefined);
      this.wakeLock = lock;
      lock.addEventListener("release", () => {
        if (this.wakeLock === lock) this.wakeLock = null;
      });
    } catch {
      /* refused (battery saver, policy): a sleeping display is then recorded without a warning */
    }
  }

  /** Gaze and a missing face become a warning only once they have lasted long enough. */
  private armLong(type: "GAZE_AWAY" | "NO_FACE", eventId: string, onsetAt: number, afterMs: number) {
    this.cancelLong(type);
    const wait = delayUntilLasted(onsetAt, Date.now(), afterMs);
    this.longTimers.set(
      type,
      window.setTimeout(() => {
        this.longTimers.delete(type);
        this.warnFor(type, eventId);
      }, wait),
    );
  }

  private cancelLong(type: string) {
    const t = this.longTimers.get(type);
    if (t) window.clearTimeout(t);
    this.longTimers.delete(type);
  }

  // ----------------------------------------------------------- second screen

  /** screen.isExtended is read on a 5 second poll as well as on its change event (some setups never fire it). */
  private watchSecondScreen(policy: ProctoringPolicy) {
    if (policy.secondScreen === "OFF") return;
    this.every(() => this.checkSecondScreen(), EXTENDED_POLL_MS);
    const scr = window.screen as unknown as EventTarget;
    if (scr.addEventListener) {
      const onChange = () => this.checkSecondScreen();
      scr.addEventListener("change", onChange);
      this.cleanups.push(() => scr.removeEventListener("change", onChange));
    }
    void this.resumeWindowManagement();
    if (!("getScreenDetails" in window) && this.readExtended() === null) this.markUnverifiable("no screen API in this browser");
  }

  /** Every reading (event, poll, screens change) ends here: the screens now against what was raised. */
  private checkSecondScreen() {
    const policy = this.snap.policy;
    if (!policy || policy.secondScreen === "OFF") return;
    const count = this.screenDetails ? this.screenDetails.screens.length : null;
    const present = secondScreenPresent(this.readExtended(), count);
    if (present !== this.snap.isExtended) this.set({ isExtended: present });
    if (!this.snap.guarding) return;
    const decision = extendedDecision(present, this.secondScreenRaised);
    if (decision === "RAISE") {
      this.secondScreenRaised = true;
      const id = this.instant("SECOND_SCREEN_DETECTED");
      this.warnFor("SECOND_SCREEN_DETECTED", id);
      void this.flush().then(() => this.captureScreen("VIOLATION", id));
    } else if (decision === "CLEAR") {
      this.secondScreenRaised = false;
      this.warn = resolveWarning(this.warn, "SECOND_SCREEN");
      this.publishWarnings();
    }
  }

  private unverifiableSent = false;
  private markUnverifiable(reason: string) {
    if (this.unverifiableSent) return;
    this.unverifiableSent = true;
    this.instant("SECOND_SCREEN_UNVERIFIABLE", { reason });
  }

  /** Development fake-media mode only: what the pretend Window Management permission answers, and the screens it reports. */
  devWindowManagement: "granted" | "denied" = "granted";
  devScreenCount = 1;
  private devScreens: (EventTarget & { screens: unknown[] }) | null = null;
  /** Development fake-media mode only: sets how many screens the pretend API reports and fires its change event. */
  setDevScreens(n: number) {
    this.devScreenCount = n;
    if (!this.devScreens) return;
    this.devScreens.screens.length = 0;
    for (let i = 0; i < n; i++) this.devScreens.screens.push({});
    this.devScreens.dispatchEvent(new Event("screenschange"));
  }

  /** Development fake-media mode only: records an event and raises its warning exactly as a real detection would. */
  devSimulate(type: ProctorEventType) {
    if (!this.snap.devFake) return;
    const id = this.instant(type);
    this.warnFor(type, id);
  }

  private attachScreenDetails(details: ScreenDetailsLike) {
    this.screenDetails = details;
    const onChange = () => this.checkSecondScreen();
    details.addEventListener("screenschange", onChange);
    this.cleanups.push(() => details.removeEventListener("screenschange", onChange));
    this.set({ windowManagement: "granted" });
    this.checkSecondScreen();
  }

  /** After a reload the permission may already be granted: use it quietly, never prompt. */
  private async resumeWindowManagement() {
    const w = window as WindowWithScreens;
    if (!w.getScreenDetails || this.snap.devFake || this.screenDetails) return;
    for (const name of ["window-management", "window-placement"]) {
      try {
        const status = await navigator.permissions.query({ name: name as PermissionName });
        if (status.state === "granted") {
          this.attachScreenDetails(await w.getScreenDetails());
        } else if (status.state === "denied") {
          this.set({ windowManagement: "denied" });
          this.markUnverifiable("window-management permission denied");
        }
        return;
      } catch {
        /* this name is not known to the browser: try the other one */
      }
    }
  }

  /**
   * Asks for the Window Management permission (the system check calls this on
   * a click): with it the number of screens is read directly, which a browser's
   * isExtended flag can miss. A refusal is recorded as SECOND_SCREEN_UNVERIFIABLE.
   */
  async requestWindowManagement() {
    const policy = this.snap.policy;
    if (!policy || policy.secondScreen === "OFF") return;
    const status = this.snap.windowManagement;
    if (status === "asking" || status === "granted" || status === "denied") return;
    if (this.snap.devFake) {
      if (this.devWindowManagement === "granted") {
        const fake = Object.assign(new EventTarget(), { screens: Array.from({ length: this.devScreenCount }, () => ({})) });
        this.devScreens = fake;
        this.attachScreenDetails(fake);
      } else {
        this.set({ windowManagement: "denied" });
        this.markUnverifiable("window-management permission denied (dev)");
      }
      return;
    }
    const w = window as WindowWithScreens;
    if (!w.getScreenDetails) {
      this.set({ windowManagement: "unsupported" });
      if (this.readExtended() === null) this.markUnverifiable("no screen API in this browser");
      return;
    }
    this.set({ windowManagement: "asking" });
    try {
      this.attachScreenDetails(await this.prompting("SCREENS", () => w.getScreenDetails!()));
    } catch {
      this.set({ windowManagement: "denied" });
      this.markUnverifiable("window-management permission denied");
    }
  }

  // ------------------------------------------------------------- camera/mic

  async startCamera() {
    this.set({ camera: "asking", mic: "asking", error: null });
    try {
      const stream = this.snap.devFake
        ? fakeCameraStream()
        : await this.prompting("CAMERA", () =>
            navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              // No echo cancellation: it removes whatever the speakers play from the
              // microphone, a helper's voice from a call included.
              audio: { echoCancellation: false, noiseSuppression: false },
            }),
          );
      this.cameraStream = stream;
      const video = stream.getVideoTracks()[0];
      const audio = stream.getAudioTracks()[0];
      if (video && /OBS|ManyCam|Snap Camera|XSplit|Virtual/i.test(video.label)) this.instant("VIRTUAL_CAMERA", { label: video.label });
      video?.addEventListener("ended", () => this.deviceLost("CAMERA"));
      audio?.addEventListener("ended", () => this.deviceLost("MIC"));
      this.camVideo = hiddenVideo(stream, "kademe-proctor-cam");
      this.setupAudio(stream);
      this.set({ camera: video ? "ok" : "denied", mic: audio ? "ok" : "denied" });
      this.syncRecording();
      return true;
    } catch (error) {
      this.set({ camera: "denied", mic: "denied", error: error instanceof Error ? error.name : String(error) });
      return false;
    }
  }

  private deviceLost(which: "CAMERA" | "MIC") {
    if (which === "CAMERA") {
      this.set({ camera: "lost" });
      this.begin("CAMERA_LOST");
      if (this.snap.guarding) this.showBanner({ kind: "recover", reason: "CAMERA" });
    } else {
      this.set({ mic: "lost" });
      this.begin("MIC_LOST");
    }
  }

  private setupAudio(stream: MediaStream) {
    if (stream.getAudioTracks().length === 0) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.audioCtx = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    this.analyser = analyser;
    const freq = new Float32Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);
    const binHz = ctx.sampleRate / analyser.fftSize;
    const lo = Math.floor(300 / binHz);
    const hi = Math.ceil(3400 / binHz);
    this.every(() => {
      if (!this.analyser) return;
      analyser.getByteTimeDomainData(timeData);
      let peak = 0;
      for (const v of timeData) peak = Math.max(peak, Math.abs(v - 128) / 128);
      analyser.getFloatFrequencyData(freq);
      // Band energy in dB and spectral flatness (geometric / arithmetic mean
      // of power): speech is tonal and low in flatness, key clicks are flat.
      let sum = 0;
      let logSum = 0;
      let n = 0;
      for (let i = lo; i <= hi && i < freq.length; i++) {
        const p = Math.pow(10, freq[i] / 10);
        sum += p;
        logSum += Math.log(p + 1e-12);
        n++;
      }
      const mean = sum / Math.max(1, n);
      const bandDb = 10 * Math.log10(mean + 1e-12);
      const flatness = Math.exp(logSum / Math.max(1, n)) / (mean + 1e-12);
      this.lastBand.push(bandDb);
      if (this.lastBand.length > 60) this.lastBand.shift();
      if (Math.abs(peak - this.snap.micLevel) > 0.02) this.set({ micLevel: peak });
      const vadOn = this.snap.policy?.aiSignals.voice && this.snap.guarding && this.vad;
      if (vadOn) {
        this.vad!.suppressed = this.voiceSuppressors.size > 0;
        const edge = this.vad!.push({ t: Date.now(), bandDb, flatness });
        if (edge === "START") {
          this.begin("VOICE_DETECTED");
          this.showBanner({ kind: "act", reason: "VOICE" }, 6000);
        } else if (edge === "END") this.end("VOICE_DETECTED");
      }
    }, 100);
  }

  private lastBand: number[] = [];

  /** Three seconds of silence, to learn the room's noise floor. */
  async calibrateQuiet(): Promise<number | null> {
    this.lastBand = [];
    await new Promise((r) => setTimeout(r, 3000));
    const floor = calibrateFloor(this.lastBand);
    if (floor !== null) this.vad = createVad({ floorDb: floor });
    this.set({ quietFloor: floor });
    return floor;
  }

  /** Speaking tasks and listening playback must not count as "talking during the exam". */
  suppressVoice(reason: string, on: boolean) {
    if (on) this.voiceSuppressors.add(reason);
    else this.voiceSuppressors.delete(reason);
  }

  // ----------------------------------------------------------------- screen

  async startScreen() {
    this.set({ screen: "asking", error: null });
    try {
      let stream: MediaStream;
      if (this.snap.devFake) stream = fakeScreenStream();
      else {
        const md = navigator.mediaDevices as MediaDevices & {
          getDisplayMedia(o: unknown): Promise<MediaStream>;
        };
        stream = await this.prompting("SCREEN", () =>
          md.getDisplayMedia({
            // No width cap: a capped Retina share would not match the screen size
            // and be flagged as "another monitor". Frames are scaled down anyway.
            video: { displaySurface: "monitor", frameRate: { ideal: 5, max: 5 } },
            audio: false,
            monitorTypeSurfaces: "include",
            selfBrowserSurface: "exclude",
            surfaceSwitching: "exclude",
          }),
        );
      }
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string };
      const verdict = this.snap.devFake
        ? { surface: "MONITOR" as const, wrongMonitor: false }
        : verifyDisplaySurface(settings, {
            width: window.screen.width,
            height: window.screen.height,
            dpr: window.devicePixelRatio || 1,
          });
      if (verdict.surface === "WRONG_SURFACE") {
        stream.getTracks().forEach((t) => t.stop());
        const id = this.instant("SCREEN_SHARE_WRONG_SURFACE", { surface: settings.displaySurface ?? null });
        this.warnFor("SCREEN_SHARE_WRONG_SURFACE", id);
        this.set({ screen: "denied", surface: "WRONG_SURFACE" });
        return false;
      }
      if (verdict.wrongMonitor) {
        const id = this.instant("SCREEN_SHARE_WRONG_SURFACE", { reason: "resolution differs from this screen" });
        this.warnFor("SCREEN_SHARE_WRONG_SURFACE", id);
      }
      this.screenStream = stream;
      this.screenVideo = hiddenVideo(stream, "kademe-proctor-screen");
      track.addEventListener("ended", () => {
        this.set({ screen: "lost" });
        this.begin("SCREEN_SHARE_STOPPED");
        if (this.snap.guarding) this.showBanner({ kind: "recover", reason: "SCREEN" });
      });
      this.end("SCREEN_SHARE_STOPPED");
      this.clearBanner("SCREEN");
      this.set({ screen: "ok", surface: verdict.surface });
      this.syncRecording();
      return true;
    } catch (error) {
      this.set({ screen: "denied", error: error instanceof Error ? error.name : String(error) });
      return false;
    }
  }

  // ------------------------------------------------------------- fullscreen

  async enterFullscreen() {
    try {
      if (!document.fullscreenElement)
        await this.prompting("FULLSCREEN", () => document.documentElement.requestFullscreen({ navigationUI: "hide" }));
      const kb = (navigator as Navigator & { keyboard?: { lock?: (keys: string[]) => Promise<void> } }).keyboard;
      await kb?.lock?.(["Escape"]).catch(() => undefined);
      this.everFullscreen = true;
      this.set({ fullscreen: true });
      this.end("FULLSCREEN_EXIT");
      this.clearBanner("FULLSCREEN");
      return true;
    } catch {
      // Development fake-media mode only: an automated browser cannot grant
      // fullscreen, so it is simulated there and nowhere else.
      if (this.snap.devFake) {
        this.set({ fullscreen: true });
        this.end("FULLSCREEN_EXIT");
        this.clearBanner("FULLSCREEN");
        return true;
      }
      this.set({ fullscreen: !!document.fullscreenElement });
      return false;
    }
  }

  // ----------------------------------------------------------------- vision

  async startVision() {
    const policy = this.snap.policy;
    if (!policy || !this.camVideo || this.snap.model === "loading" || this.snap.model === "ready") return;
    const wants = policy.aiSignals.face || policy.aiSignals.gaze || policy.aiSignals.phone;
    if (!wants) return;
    this.set({ model: "loading" });
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await withTimeout(vision.FilesetResolver.forVisionTasks(`${ASSETS}/wasm`), 20_000);
      const make = async (delegate: "GPU" | "CPU") =>
        vision.FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: `${ASSETS}/face_landmarker.task`, delegate },
          runningMode: "VIDEO",
          numFaces: 3,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
      const face = await withTimeout(make("GPU").catch(() => make("CPU")), 20_000);
      // One object model for phones and for people: a second person the face
      // model misses (turned away, far behind, half in frame) still has a body.
      const objectCategories = [
        ...(policy.aiSignals.phone ? ["cell phone"] : []),
        ...(policy.aiSignals.face ? ["person"] : []),
      ];
      const objects = objectCategories.length > 0
        ? await withTimeout(
            vision.ObjectDetector.createFromOptions(files, {
              baseOptions: { modelAssetPath: `${ASSETS}/efficientdet_lite0.tflite`, delegate: "CPU" },
              runningMode: "VIDEO",
              categoryAllowlist: objectCategories,
              scoreThreshold: 0.3,
              maxResults: 6,
            }),
            20_000,
          ).catch(() => null)
        : null;
      this.tracker = createSignalTracker();
      let tick = 0;
      let slow = 0;
      let people: number | null = null;
      this.visionLoop = window.setInterval(() => {
        const video = this.camVideo;
        if (!video || video.readyState < 2) return;
        const t0 = performance.now();
        const ts = performance.now();
        const r = face.detectForVideo(video, ts);
        // The fake camera shows no face; in that mode the count is scripted.
        const faces = this.snap.devFake ? this.devFaces : r.faceLandmarks.length;
        let yaw: number | null = null;
        let pitch: number | null = null;
        let eyesAway = false;
        if (faces === 1 && r.facialTransformationMatrixes[0]) {
          const pose = yawPitchFromMatrix(r.facialTransformationMatrixes[0].data);
          yaw = pose.yawDeg;
          pitch = pose.pitchDeg;
        }
        const shapes = r.faceBlendshapes[0]?.categories ?? [];
        const score = (n: string) => shapes.find((c) => c.categoryName === n)?.score ?? 0;
        eyesAway =
          (score("eyeLookOutLeft") > 0.6 && score("eyeLookInRight") > 0.6) ||
          (score("eyeLookInLeft") > 0.6 && score("eyeLookOutRight") > 0.6);
        let phoneScore: number | null = null;
        tick++;
        if (objects && tick % 4 === 0) {
          const d = objects.detectForVideo(video, ts + 0.5);
          const found = d.detections.map((x) => ({ name: x.categories[0]?.categoryName, score: x.categories[0]?.score ?? 0, box: x.boundingBox }));
          if (policy.aiSignals.phone) {
            phoneScore = Math.max(0, ...found.filter((x) => x.name === "cell phone").map((x) => x.score));
          }
          if (policy.aiSignals.face) {
            const frameArea = video.videoWidth * video.videoHeight;
            people = this.snap.devFake ? null : countPeople(found.filter((x) => x.name === "person"), frameArea);
          }
        }
        if (faces !== this.snap.faces) this.set({ faces });
        if (this.snap.guarding && this.tracker) {
          // The object model runs every 4th frame; its count holds in between.
          const events = this.tracker.push({ t: Date.now(), faces, people, yawDeg: yaw, pitchDeg: pitch, eyesAway, phoneScore, lastKeyAt: this.lastKeyAt });
          for (const e of events) this.onSignal(e.kind, e.type, e.t);
        }
        // Slow machine: halve the rate rather than freeze the exam.
        if (performance.now() - t0 > 120) slow++;
        else slow = Math.max(0, slow - 1);
        if (slow > 10 && this.visionLoop) {
          window.clearInterval(this.visionLoop);
          this.visionLoop = window.setInterval(() => undefined, 1000);
          this.instant("PROCTOR_MODEL_UNAVAILABLE", { reason: "too slow on this device" });
          this.set({ model: "unavailable" });
        }
      }, 500);
      this.set({ model: "ready" });
    } catch (error) {
      this.instant("PROCTOR_MODEL_UNAVAILABLE", { reason: error instanceof Error ? error.message.slice(0, 120) : "load failed" });
      this.set({ model: "unavailable" });
    }
  }

  /** `onset` is when the condition began to hold (the tracker reports a start only after it has held for a while). */
  private onSignal(kind: "START" | "END", type: "NO_FACE" | "MULTIPLE_FACES" | "GAZE_AWAY" | "PHONE_DETECTED", onset: number) {
    const p = this.snap.policy?.aiSignals;
    if (!p) return;
    const enabled =
      type === "GAZE_AWAY" ? p.gaze : type === "PHONE_DETECTED" ? p.phone : p.face;
    if (!enabled) return;
    if (kind === "END") {
      this.end(type);
      if (type === "NO_FACE") this.clearBanner("NO_FACE");
      this.cancelLong(type);
      return;
    }
    const id = type === "PHONE_DETECTED" ? this.instant(type) : this.begin(type);
    if (type === "NO_FACE") this.showBanner({ kind: "act", reason: "NO_FACE" });
    else if (type !== "GAZE_AWAY") this.showBanner({ kind: "info", reason: "RECORDED" }, 6000);
    if (type !== "GAZE_AWAY") void this.captureViolation(id);
    // A phone or another person is a warning at once; gaze away (6 s) and a missing face (10 s)
    // only once they have lasted that long, so a short glance or a lean out of frame is not one.
    if (type === "GAZE_AWAY") this.armLong(type, id, onset, GAZE_WARNING_AFTER_MS);
    else if (type === "NO_FACE") this.armLong(type, id, onset, NO_FACE_WARNING_AFTER_MS);
    else this.warnFor(type, id);
  }

  // --------------------------------------------------------------- evidence

  private async upload(blob: Blob, q: Record<string, string | number | null | undefined>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== null && v !== undefined) params.set(k, String(v));
    try {
      await fetch(`${this.api("/proctor/evidence")}?${params}`, { method: "PUT", body: blob, headers: { "content-type": blob.type } });
    } catch {
      /* best effort: a missing frame is reported as a gap, not invented */
    }
  }

  private async frame(video: HTMLVideoElement | null, maxWidth: number, quality: number) {
    if (!video || video.readyState < 2 || !video.videoWidth) return null;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob ? { blob, w, h } : null;
  }

  async captureWebcam(trigger: "REFERENCE" | "PERIODIC" | "VIOLATION", eventId?: string) {
    const f = await this.frame(this.camVideo, 320, 0.6);
    if (!f) return false;
    await this.upload(f.blob, { kind: "WEBCAM_FRAME", trigger, at: this.now(), event: eventId, w: f.w, h: f.h, faces: this.snap.faces });
    return true;
  }

  async captureScreen(trigger: "PERIODIC" | "VIOLATION", eventId?: string) {
    const f = await this.frame(this.screenVideo, 1280, 0.5);
    if (!f) return false;
    await this.upload(f.blob, { kind: "SCREEN_FRAME", trigger, at: this.now(), event: eventId, w: f.w, h: f.h });
    return true;
  }

  private async captureViolation(eventId: string) {
    await this.flush();
    await this.captureWebcam("VIOLATION", eventId);
    // One second later the shared screen shows whatever was switched to.
    window.setTimeout(() => void this.captureScreen("VIOLATION", eventId), 1000);
  }

  // ----------------------------------------------------------------- guards

  /** Arms everything for the exam itself. Idempotent. */
  arm() {
    const policy = this.snap.policy;
    if (!policy || this.snap.guarding) return;
    this.set({ guarding: true });
    const on = <K extends keyof WindowEventMap>(target: Window | Document, type: K | string, fn: (e: Event) => void, capture = true) => {
      target.addEventListener(type, fn, capture);
      this.cleanups.push(() => target.removeEventListener(type, fn, capture));
    };
    // `warn`: copying, cutting and pasting are a big warning; dragging and the context menu are only recorded.
    const block = (type: ProctorEventType, warn = false) => (e: Event) => {
      if (!policy.clipboardBlock) return;
      e.preventDefault();
      const id = this.instant(type);
      if (warn) this.warnFor(type, id);
    };
    on(document, "copy", block("COPY_ATTEMPT", true));
    on(document, "cut", block("COPY_ATTEMPT", true));
    on(document, "paste", block("PASTE_ATTEMPT", true));
    on(document, "contextmenu", block("CONTEXT_MENU"));
    on(document, "dragstart", block("COPY_ATTEMPT"));
    on(document, "drop", block("PASTE_ATTEMPT"));
    on(window, "beforeprint", () => this.instant("PRINT_ATTEMPT"));
    on(document, "keydown", (e) => {
      const k = e as KeyboardEvent;
      this.lastKeyAt = Date.now();
      const key = k.key.toLowerCase();
      const mod = k.ctrlKey || k.metaKey;
      const devtools = k.key === "F12" || (mod && k.shiftKey && ["i", "j", "c"].includes(key));
      const blocked = mod && ["c", "v", "x", "p", "s", "f", "u"].includes(key);
      if (policy.clipboardBlock && (devtools || blocked)) {
        k.preventDefault();
        const id = this.instant("BLOCKED_SHORTCUT", { key: `${mod ? "mod+" : ""}${k.shiftKey ? "shift+" : ""}${key}` });
        this.warnFor("BLOCKED_SHORTCUT", id, { shortcutKey: mod && !k.shiftKey ? key : undefined });
      }
    });
    on(document, "beforeinput", (e) => {
      const ie = e as InputEvent;
      if (ie.inputType === "insertFromPaste" || ie.inputType === "insertFromDrop") {
        if (policy.clipboardBlock) {
          ie.preventDefault();
          const id = this.instant("PASTE_ATTEMPT");
          if (ie.inputType === "insertFromPaste") this.warnFor("PASTE_ATTEMPT", id);
        }
      } else if (ie.inputType === "insertText" && (ie.data?.length ?? 0) > 30) {
        this.instant("LARGE_TEXT_INSERT", { length: ie.data!.length });
      }
    });
    // Leaving the tab or the window: leave-detector.ts decides what is recorded and what is warned.
    // The big warning is raised when the student comes back: that is when they can read it.
    on(document, "visibilitychange", () => {
      if (document.hidden) this.feedLeave({ type: "hidden", t: Date.now() });
      else {
        this.feedLeave({ type: "visible", t: Date.now(), hasFocus: document.hasFocus() });
        void this.holdWakeLock();
      }
    });
    // Not in the capture phase, and only the window's own events: a field losing focus inside
    // the page (a click from the text box onto the reading text) also passes the window while
    // capturing, and was once counted as leaving the exam.
    on(window, "blur", (e) => e.target === window && this.feedLeave({ type: "blur", t: Date.now() }), false);
    on(window, "focus", (e) => e.target === window && this.feedLeave({ type: "focus", t: Date.now() }), false);
    for (const type of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) {
      on(document, type, () => {
        this.leave.lastInputAt = Date.now();
      });
    }
    // Catches a focus or visibility event the browser did not send.
    this.every(() => this.feedLeave({ type: "tick", t: Date.now(), hasFocus: document.hasFocus(), hidden: document.hidden }), 500);
    void this.holdWakeLock();
    on(document, "fullscreenchange", () => {
      const fs = !!document.fullscreenElement || (this.snap.devFake && this.snap.fullscreen);
      this.set({ fullscreen: fs });
      if (!fs && policy.fullscreen) {
        this.begin("FULLSCREEN_EXIT");
        this.showBanner({ kind: "recover", reason: "FULLSCREEN" });
      } else if (fs) {
        this.end("FULLSCREEN_EXIT");
        this.clearBanner("FULLSCREEN");
      }
    });
    on(window, "offline", () => this.begin("OFFLINE"));
    on(window, "online", () => {
      this.end("OFFLINE");
      void this.flush();
    });
    let resizeTimer: number | null = null;
    on(window, "resize", () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (document.fullscreenElement && Math.abs(window.innerWidth - window.screen.width) > 100)
          this.instant("WINDOW_RESIZED", { inner: window.innerWidth, screen: window.screen.width });
      }, 800);
    });
    on(window, "pagehide", () => {
      this.instant("PAGE_UNLOAD");
      void this.flush(true);
    });
    // The screen change event and the 5 second poll are set up at session start (watchSecondScreen);
    // read once now, so a screen already connected when the exam begins is not waited out.
    this.checkSecondScreen();
    if (navigator.webdriver) this.instant("AUTOMATION");
    // A second tab with the same exam.
    try {
      const channel = new BroadcastChannel(`kademe-exam-${this.token.slice(0, 16)}`);
      const me = rid();
      channel.onmessage = (m) => {
        if (m.data?.hello && m.data.hello !== me) {
          const id = this.instant("DUPLICATE_TAB");
          this.warnFor("DUPLICATE_TAB", id);
          channel.postMessage({ seen: me });
        }
      };
      channel.postMessage({ hello: me });
      this.cleanups.push(() => channel.close());
    } catch {
      /* no BroadcastChannel: the server's DUPLICATE_SESSION still catches it */
    }
    // Translation and writing helpers inject their own markup.
    const seen = new Set<string>();
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of Array.from(r.addedNodes)) {
          if (!(n instanceof Element)) continue;
          const sig = `${n.tagName} ${n.id} ${n.className}`.toLowerCase();
          const hit = ["grammarly", "deepl", "goog-te", "translate", "languagetool"].find((w) => sig.includes(w));
          if (hit && !seen.has(hit)) {
            seen.add(hit);
            this.instant("EXTENSION_INJECTED", { marker: hit });
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    this.cleanups.push(() => observer.disconnect());
    this.instant("RESUMED", { armedAt: new Date().toISOString() });
    // Periodic evidence.
    this.every(() => void this.captureWebcam("PERIODIC"), policy.snapshots.webcamSeconds * 1000);
    if (policy.screenShare) this.every(() => void this.captureScreen("PERIODIC"), policy.snapshots.screenSeconds * 1000);
    this.syncRecording();
  }

  /** Starts (or, after a reload or a lost device, restarts) the continuous recording of what is live. */
  private syncRecording() {
    if (!this.snap.guarding || !this.snap.policy || !this.recordingConsented) return;
    if (!this.recording) {
      this.recording = new ProctorRecording({
        url: (path) => this.api(path),
        now: () => this.now(),
        sessionId: () => this.sessionId,
        onStatus: (s) => this.set({ upload: { pending: s.pending, stalled: s.stalled } }),
        onActivity: (a) => this.set({ recording: a.camera || a.screen ? a : null }),
      });
      this.set({ upload: { pending: 0, stalled: false } });
    }
    this.recording.sync({
      policy: this.snap.policy,
      consented: this.recordingConsented,
      guarding: true,
      camera: this.cameraStream,
      screen: this.screenStream,
    });
  }

  /**
   * After stop(): waits until the recording's last segments are uploaded
   * (true) or `timeoutMs` passes (false). True at once when nothing was recorded.
   */
  drainRecording(timeoutMs = 60_000): Promise<boolean> {
    return this.recording ? this.recording.drain(timeoutMs) : Promise.resolve(true);
  }

  /** Ends proctoring for good: every track, fullscreen, timers, listeners. */
  async stop() {
    for (const [type] of this.open) this.end(type as ProctorEventType);
    await this.flush();
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    this.timers.forEach((t) => window.clearInterval(t));
    this.timers = [];
    for (const t of this.longTimers.values()) window.clearTimeout(t);
    this.longTimers.clear();
    if (this.visionLoop) window.clearInterval(this.visionLoop);
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
    // Cut the last segments while the tracks still run; they upload in the
    // background, and the last screen waits for them (drainRecording).
    await this.recording?.stop();
    this.cameraStream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.camVideo?.remove();
    this.screenVideo?.remove();
    void this.audioCtx?.close().catch(() => undefined);
    this.analyser = null;
    const kb = (navigator as Navigator & { keyboard?: { unlock?: () => void } }).keyboard;
    kb?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    this.set({ guarding: false, camera: "idle", mic: "idle", screen: "idle", fullscreen: false, banner: null, model: "off", warning: null });
  }

  /** True when every live resource this policy needs is still running (after a reload they are not). */
  needsResume(): Array<"CAMERA" | "SCREEN" | "FULLSCREEN"> {
    const p = this.snap.policy;
    if (!p) return [];
    const out: Array<"CAMERA" | "SCREEN" | "FULLSCREEN"> = [];
    if ((p.camera || p.microphone) && this.snap.camera !== "ok") out.push("CAMERA");
    if (p.screenShare && this.snap.screen !== "ok") out.push("SCREEN");
    if (p.fullscreen && !this.snap.fullscreen) out.push("FULLSCREEN");
    return out;
  }
}

function hiddenVideo(stream: MediaStream, id: string) {
  document.getElementById(id)?.remove();
  const v = document.createElement("video");
  v.id = id;
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  // Not display:none: some browsers stop decoding hidden videos, and the
  // models and frames read from this element.
  Object.assign(v.style, { position: "fixed", right: "0", bottom: "0", width: "2px", height: "2px", opacity: "0.01", pointerEvents: "none" });
  v.srcObject = stream;
  document.body.appendChild(v);
  void v.play().catch(() => undefined);
  return v;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

/** Development only (the server decides): a moving test picture and a quiet tone. */
function fakeCameraStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  let t = 0;
  const draw = () => {
    t++;
    ctx.fillStyle = "#1f2a27";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#0e6a57";
    ctx.beginPath();
    ctx.arc(320 + Math.sin(t / 20) * 40, 220, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.fillText("Kademe dev camera", 230, 420);
    requestAnimationFrame(draw);
  };
  draw();
  const video = (canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(10);
  const actx = new AudioContext();
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  gain.gain.value = 0.001;
  osc.connect(gain);
  const dest = actx.createMediaStreamDestination();
  gain.connect(dest);
  osc.start();
  return new MediaStream([...video.getVideoTracks(), ...dest.stream.getAudioTracks()]);
}

function fakeScreenStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;
  const draw = () => {
    ctx.fillStyle = "#f6f5f2";
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = "#0e6a57";
    ctx.font = "32px sans-serif";
    ctx.fillText(`Kademe dev screen ${new Date().toLocaleTimeString()}`, 60, 100);
    setTimeout(draw, 1000);
  };
  draw();
  return (canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(2);
}

/** One engine per exam tab, shared by every page of the flow. */
export function engineFor(token: string): ProctorEngine {
  const w = window as unknown as { __kademeProctor?: ProctorEngine };
  if (!w.__kademeProctor || w.__kademeProctor.token !== token) w.__kademeProctor = new ProctorEngine(token);
  return w.__kademeProctor;
}
