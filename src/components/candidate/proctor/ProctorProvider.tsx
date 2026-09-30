"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { engineFor, type EngineSnapshot, type ProctorEngine } from "@/lib/client/proctor/engine";
import type { ProctorEventType } from "@/lib/proctor/taxonomy";

/**
 * Lives in the student layout, so the camera, the screen share and fullscreen
 * survive moving from the system check to the exam and between questions.
 * A hard reload still loses them; the exam page then shows the resume gate.
 */

type Ctx = { engine: ProctorEngine | null };
const ProctorContext = createContext<Ctx>({ engine: null });

export function ProctorProvider({ token, children }: { token: string; children: React.ReactNode }) {
  const [engine, setEngine] = useState<ProctorEngine | null>(null);
  useEffect(() => {
    // The engine touches window and localStorage, so it is made after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEngine(engineFor(token));
  }, [token]);
  return (
    <ProctorContext.Provider value={{ engine }}>
      <DevFakeNotice engine={engine} />
      {children}
    </ProctorContext.Provider>
  );
}

const EMPTY: EngineSnapshot | null = null;

export function useProctor(): { engine: ProctorEngine | null; snap: EngineSnapshot | null } {
  const { engine } = useContext(ProctorContext);
  const snap = useSyncExternalStore(
    (fn) => (engine ? engine.subscribe(fn) : () => undefined),
    () => (engine ? engine.snapshot : EMPTY),
    () => EMPTY,
  );
  useEffect(() => {
    if (!engine || !snap?.devFake) return;
    // Development only, and only when the server said so: lets an automated
    // browser without a camera exercise every banner and recovery path.
    (window as unknown as { __proctorDev?: unknown }).__proctorDev = {
      emit: (type: ProctorEventType) => engine.instant(type),
      begin: (type: ProctorEventType) => engine.begin(type),
      end: (type: ProctorEventType) => engine.end(type),
      snapshot: () => engine.snapshot,
      setFaces: (n: number) => {
        engine.devFaces = n;
      },
    };
  }, [engine, snap?.devFake]);
  return { engine, snap };
}

/** Environment facts sent with the session, for the teacher's coverage line. */
export function environmentFacts(): Record<string, unknown> {
  const s = window.screen as Screen & { isExtended?: boolean };
  return {
    userAgent: navigator.userAgent.slice(0, 200),
    screen: { w: s.width, h: s.height, dpr: window.devicePixelRatio },
    isExtendedSupported: "isExtended" in s,
    isExtended: typeof s.isExtended === "boolean" ? s.isExtended : null,
    language: navigator.language,
    webdriver: !!navigator.webdriver,
  };
}

/**
 * Fake camera and screen exist only for automated testing in development.
 * When they are on, it must be impossible to mistake them for the real thing.
 */
function DevFakeNotice({ engine }: { engine: ProctorEngine | null }) {
  const snap = useSyncExternalStore(
    (fn) => (engine ? engine.subscribe(fn) : () => undefined),
    () => (engine ? engine.snapshot : EMPTY),
    () => EMPTY,
  );
  if (!snap?.devFake) return null;
  return (
    <div role="status" className="sticky top-0 z-50 bg-danger px-4 py-1.5 text-center text-[12.5px] font-semibold text-white">
      DEV: PROCTOR_DEV_FAKE=1 · sahte kamera ve ekran (fake camera and screen)
    </div>
  );
}
