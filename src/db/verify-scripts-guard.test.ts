import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The verify scripts that write rows refuse a database they must not touch
 * before they open a connection (Task 10 review): verify:guard and verify:exam
 * only run on the local working database (never the shared `kademe`, which
 * `.env` names), verify:hiring-flow and dev:hiring-link only on a throw-away
 * *_check copy, because they publish frozen rows. Each script runs on import;
 * the database module is a mock that records any use, so a missing guard
 * fails here without touching any database (the dev-link-guard.test pattern).
 */

const h = vi.hoisted(() => ({ dbReached: vi.fn<() => void>(), scratchMade: vi.fn<() => void>() }));

// verify:hiring-flow makes a scratch storage directory right after its guard, in the
// same tick: recorded instead of created, so a script that runs on past a refusal
// (process.exit is mocked here) is caught deterministically.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const mkdtempSync = () => {
    h.scratchMade();
    return "/nonexistent/kademe-flow-test";
  };
  return { ...actual, default: { ...actual, mkdtempSync }, mkdtempSync };
});

// The test sets DATABASE_URL itself; .env (which names the shared database) must not fill it in.
vi.mock("dotenv/config", () => ({}));
// Any use of the database is recorded; it holds no organisation.
vi.mock("@/db", () => ({
  db: new Proxy(
    { select: () => ({ from: () => ({ limit: async () => [] }) }) },
    {
      get: (target, prop, receiver) => {
        if (prop !== "then") h.dbReached();
        return Reflect.get(target, prop, receiver);
      },
    },
  ),
}));

let exit: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;
let logs: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  h.dbReached.mockReset();
  h.scratchMade.mockReset();
  exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  logs = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  exit.mockRestore();
  errors.mockRestore();
  logs.mockRestore();
});

const SCRIPTS = {
  "verify:guard": () => import("../../scripts/verify-solution-guard"),
  "verify:exam": () => import("../../scripts/verify-exam-flow"),
  "verify:hiring-flow": () => import("../../scripts/verify-hiring-flow"),
  "dev:hiring-link": () => import("../../scripts/dev-hiring-link"),
} as const;

async function run(script: keyof typeof SCRIPTS, url: string) {
  vi.stubEnv("DATABASE_URL", url);
  await SCRIPTS[script]();
  await vi.waitFor(() => expect(exit).toHaveBeenCalled(), { timeout: 10_000 });
}

const SHARED = "postgresql://kademe:kademe@localhost:5434/kademe";
const WORKING = "postgresql://kademe:kademe@localhost:5434/kademe_platform";

describe.each(["verify:guard", "verify:exam"] as const)("%s working-database guard", (script) => {
  it.each([
    ["the shared kademe database", SHARED, /shared/],
    ["a remote host", "postgresql://kademe:kademe@db.example.com:5434/kademe_platform", /local/],
    ["another port", "postgresql://kademe:kademe@localhost:5432/kademe_platform", /5434/],
    ["a missing url", "", /DATABASE_URL/],
  ])("refuses %s before opening the database", async (_label, url, reason) => {
    await run(script, url);
    expect(exit).toHaveBeenCalledWith(2);
    expect(String(errors.mock.calls[0]?.[0])).toMatch(reason);
    expect(h.dbReached).not.toHaveBeenCalled();
  });

  it("goes on to the database for the local working database", async () => {
    await run(script, WORKING);
    expect(h.dbReached).toHaveBeenCalled();
    // The mocked database holds nothing, so the script stops there (exit 1), not at the guard.
    expect(exit).toHaveBeenCalledWith(1);
    expect(exit).not.toHaveBeenCalledWith(2);
  });
}, 30_000);

describe.each(["verify:hiring-flow", "dev:hiring-link"] as const)("%s throw-away guard", (script) => {
  it.each([
    ["the shared kademe database", SHARED, /shared/],
    ["the working database kademe_platform", WORKING, /_check/],
  ])("refuses %s before opening the database", async (_label, url, reason) => {
    await run(script, url);
    expect(exit).toHaveBeenCalledWith(2);
    expect(String(errors.mock.calls[0]?.[0])).toMatch(reason);
    expect(h.dbReached).not.toHaveBeenCalled();
    // Nothing after the refusal runs, not even the scratch directory.
    expect(h.scratchMade).not.toHaveBeenCalled();
  });
});
