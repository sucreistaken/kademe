"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiSend } from "@/lib/client/api";
import type { FlushRegistry } from "@/lib/client/flush-registry";
import { useT } from "@/i18n/candidate-client";

/**
 * What every activity inside a running stage needs from the stage around it:
 * which stage position it is writing to (sent with every write, so a stale tab
 * is refused rather than silently answering the wrong stage) and where to
 * register a pending save so the submit can wait for it.
 */
export type StageSession = {
  position: number;
  flushes: FlushRegistry;
};

export const StageSessionContext = createContext<StageSession | null>(null);

export function useStageSession(): StageSession {
  const session = useContext(StageSessionContext);
  if (!session) {
    throw new Error("useStageSession must be used inside a StageRunner");
  }
  return session;
}

/**
 * Draft autosave. Nothing the candidate types is ever lost to a closed tab, and
 * there is no Save button to hunt for: the only feedback is a quiet
 * "Kaydedildi" line under the field.
 */

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useAutosave(token: string, activityIndex: number, delayMs = 800) {
  const { position, flushes } = useStageSession();
  const [status, setStatus] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  /**
   * Saves are chained, one request after the other, for two reasons: a slow
   * earlier draft can then never overwrite a later one on the server, and
   * "wait until my draft is saved" is one promise, whether the pending body
   * is still debounced or already on the wire.
   */
  const inflight = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    const body = pending.current;
    if (body) {
      pending.current = null;
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      setStatus("saving");
      inflight.current = inflight.current
        .then(() =>
          apiSend(
            token,
            "/response",
            { stagePosition: position, activityIndex, ...body },
            "PUT",
          ),
        )
        .then(
          () => {
            setStatus("saved");
            setSavedAt(Date.now());
          },
          () => setStatus("error"),
        );
    }
    return inflight.current;
  }, [token, position, activityIndex]);

  const save = useCallback(
    (body: Record<string, unknown>, immediate = false) => {
      pending.current = body;
      if (timer.current) window.clearTimeout(timer.current);
      if (immediate) {
        void flush();
        return;
      }
      timer.current = window.setTimeout(() => void flush(), delayMs);
    },
    [flush, delayMs],
  );

  // The registry fires the flush once more on unregister (unmount), so a
  // debounced draft goes out when the candidate moves to the next question
  // and the stage submit still waits for it.
  useEffect(
    () => flushes.register(String(activityIndex), flush),
    [flushes, activityIndex, flush],
  );

  return { save, flush, status, savedAt };
}

export function SavedMark({
  status,
  savedAt,
}: {
  status: SaveState;
  savedAt: number | null;
}) {
  // The relative "N seconds ago" part is recomputed on a timer rather than
  // render, so the component stays pure and the label still ages.
  const t = useT("common");
  const [age, setAge] = useState("");

  useEffect(() => {
    if (!savedAt) return;
    const update = () => {
      const seconds = Math.max(1, Math.round((Date.now() - savedAt) / 1000));
      setAge(
        seconds < 60 ? t("justNow") : t("secondsAgo", { seconds }),
      );
    };
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 5000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [savedAt, t]);

  if (status === "error") {
    return <span className="text-[12px] font-medium text-danger">{t("saveFailed")}</span>;
  }
  if (status === "saving") {
    return <span className="text-[12px] font-medium text-muted">{t("saving")}</span>;
  }
  if (status === "saved" && savedAt) {
    return (
      <span className="inline-flex items-center gap-[7px] text-[12px] font-medium text-muted">
        <span className="font-semibold text-ink">✓</span>
        {age ? t("savedAgo", { age }) : t("saved")}
      </span>
    );
  }
  return <span className="text-[12px] font-medium text-muted">{t("autosaveHint")}</span>;
}

/** The uppercase kicker above every question. */
export function ActivityKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-[0.04em] text-muted">
      {children}
    </div>
  );
}

/** The question itself, at the size the artboard gives that activity type. */
export function ActivityPrompt({
  prompt,
  note,
  size = "md",
}: {
  prompt: string;
  note?: string;
  size?: "md" | "lg";
}) {
  return (
    <>
      <h2
        className={
          size === "lg"
            ? "mt-2.5 text-2xl font-semibold leading-[1.4] text-ink text-pretty"
            : "mt-2.5 text-[23px] font-semibold leading-[1.42] text-ink text-pretty"
        }
      >
        {prompt}
      </h2>
      {note ? (
        <p className="mt-2.5 text-[13.5px] leading-[1.6] text-muted">{note}</p>
      ) : null}
    </>
  );
}
