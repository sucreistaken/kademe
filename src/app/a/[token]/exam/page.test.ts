import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

/**
 * The exam page hands the exam's phone flag (the web check, 2026-11-09) to the
 * desktop-only gate, and the check page to the system check; every other exam
 * passes false, so a phone keeps getting the desktop-only screen.
 */

const h = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock("@/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : () => { throw new Error("database reached"); }) }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148" }) }));
vi.mock("@/lib/candidate-context", () => ({ supportedLocales: () => ["tr", "en", "de", "es", "ar"] }));
vi.mock("@/lib/candidate-pages", () => ({ solutionPage: async () => undefined }));
vi.mock("@/app/a/[token]/shared", () => ({
  enter: async () => ({ kind: "ok", ctx: { assessment: { solution: "LANGUAGE_EXAM" } }, state: h.state, locale: "en" }),
}));

import ExamPage from "./page";
import CheckPage from "../check/page";
import { DesktopOnlyGate } from "@/components/candidate/DesktopOnlyGate";
import { SystemCheck } from "@/components/candidate/proctor/SystemCheck";
import { PRESETS } from "@/lib/proctor/policy";

const TOKEN = "t".repeat(43);

function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, type);
      if (hit) return hit;
    }
    return null;
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === type) return element as ReactElement<Record<string, unknown>>;
  return find(element.props?.children, type);
}

const stateOf = (allowMobile: boolean | undefined) => ({
  step: "SECTION_INTRO",
  proctoring: PRESETS.OFF,
  sections: [{ section: "GRAMMAR", position: 1, minutes: 25, itemsLabel: "7", navigable: true, textOnly: true, textKinds: [], done: false }],
  ...(allowMobile === undefined ? {} : { allowMobile }),
});

const examGate = async (allowMobile: boolean | undefined) => {
  h.state = stateOf(allowMobile);
  const page = await ExamPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve({}) });
  return find(page, DesktopOnlyGate);
};

const checkProps = async (allowMobile: boolean | undefined) => {
  h.state = stateOf(allowMobile);
  const page = await CheckPage({ params: Promise.resolve({ token: TOKEN }), searchParams: Promise.resolve({}) });
  return find(page, SystemCheck)?.props;
};

describe("the exam page's gate", () => {
  it("lets the web check through on a phone", async () => {
    const gate = await examGate(true);
    expect(gate?.props.allowMobile).toBe(true);
    expect(gate?.props.serverHint).toBe("mobile");
  });

  it("keeps every other exam desktop only", async () => {
    expect((await examGate(false))?.props.allowMobile).toBe(false);
    expect((await examGate(undefined))?.props.allowMobile).toBe(false);
  });
});

describe("the check page", () => {
  it("passes the flag to the system check", async () => {
    expect((await checkProps(true))?.allowMobile).toBe(true);
    expect((await checkProps(false))?.allowMobile).toBe(false);
    expect((await checkProps(undefined))?.allowMobile).toBe(false);
  });
});
