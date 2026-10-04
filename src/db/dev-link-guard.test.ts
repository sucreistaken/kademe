import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `pnpm dev:link` writes an invitation into whatever DATABASE_URL names, so it
 * refuses anything but the local working database before it opens a
 * connection (ruling C1). The script runs on import; the database module is a
 * mock that records any use, so a missing guard fails here without
 * touching any database.
 */

const h = vi.hoisted(() => ({ dbReached: vi.fn<() => void>() }));

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
vi.mock("@/server/invite", () => ({ createInvitation: async () => ({ ok: false, code: "UNUSED" }) }));

let exit: ReturnType<typeof vi.spyOn>;
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  h.dbReached.mockReset();
  exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  exit.mockRestore();
  errors.mockRestore();
});

async function run(url: string) {
  vi.stubEnv("DATABASE_URL", url);
  await import("../../scripts/dev-link");
  await vi.waitFor(() => expect(exit).toHaveBeenCalled());
}

describe("dev:link working-database guard", () => {
  it.each([
    ["the shared kademe database", "postgresql://kademe:kademe@localhost:5434/kademe", /shared/],
    ["a remote host", "postgresql://kademe:kademe@db.example.com:5434/kademe_platform", /local/],
    ["another port", "postgresql://kademe:kademe@localhost:5432/kademe_platform", /5434/],
    ["a missing url", "", /DATABASE_URL/],
  ])("refuses %s before opening the database", async (_label, url, reason) => {
    await run(url);
    expect(exit).toHaveBeenCalledWith(2);
    expect(String(errors.mock.calls[0]?.[0])).toMatch(reason);
    expect(h.dbReached).not.toHaveBeenCalled();
  });

  it("goes on to the database for the local working database", async () => {
    await run("postgresql://kademe:kademe@localhost:5434/kademe_platform");
    expect(h.dbReached).toHaveBeenCalled();
    // The mocked database has no organisation, so the script stops there (exit 1), not at the guard.
    expect(exit).toHaveBeenCalledWith(1);
    expect(exit).not.toHaveBeenCalledWith(2);
  });
});
