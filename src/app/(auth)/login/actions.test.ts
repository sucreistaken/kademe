import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { hash } from "@node-rs/argon2";

/**
 * The login action in both modes. Obviously fake passwords only: the real
 * panel password lives in the server environment as a hash and nowhere else.
 */
const h = vi.hoisted(() => ({
  reads: [] as Array<{ sql: string; params: unknown[] }>,
  rows: [] as unknown[],
  inserts: [] as unknown[],
  updates: 0,
  sessions: [] as string[],
  cookies: [] as string[],
  ip: "203.0.113.7",
}));

vi.mock("@/db", () => {
  const real = drizzle.mock();
  const select = real.select.bind(real) as (fields?: unknown) => object;
  const capture = <T extends object>(builder: T): T =>
    new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === "then") {
          return (resolve: (rows: unknown[]) => unknown) => {
            h.reads.push((target as unknown as { toSQL(): { sql: string; params: unknown[] } }).toSQL());
            return Promise.resolve(h.rows).then(resolve);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const out = value.apply(target, args);
          return out && typeof out === "object" && "toSQL" in out ? capture(out) : out;
        };
      },
    });
  const chain = (onDone: (values: unknown) => void) => {
    let values: unknown;
    const c: Record<string, unknown> = {};
    c.set = () => c;
    c.where = () => c;
    c.values = (v: unknown) => {
      values = v;
      return c;
    };
    c.then = (resolve: (v: unknown) => unknown) => {
      onDone(values);
      return Promise.resolve([]).then(resolve);
    };
    return c;
  };
  return {
    db: {
      select: (fields?: unknown) => capture(select(fields)),
      insert: () => chain((v) => h.inserts.push(v)),
      update: () => chain(() => (h.updates += 1)),
    },
  };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": h.ip, "user-agent": "vitest" }),
  cookies: async () => ({ set: (name: string) => h.cookies.push(name) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("@/lib/auth", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/auth")>()),
  createSession: async (userId: string) => {
    h.sessions.push(userId);
    return { token: "fake-token", expiresAt: new Date(Date.now() + 60_000) };
  },
}));

import { login } from "./actions";
import { panelLoginLimiter } from "@/lib/panel-login";

const PANEL_PASSWORD = "fake-panel-pass-for-tests";
const EMAIL_PASSWORD = "fake-email-pass-for-tests";
const OWNER = { id: "11111111-1111-4111-8111-111111111111", orgId: "22222222-2222-4222-8222-222222222222" };
const argon = (plain: string) => hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

let panelHash = "";
let emailHash = "";
beforeAll(async () => {
  panelHash = await argon(PANEL_PASSWORD);
  emailHash = await argon(EMAIL_PASSWORD);
});

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  h.reads = [];
  h.rows = [];
  h.inserts = [];
  h.updates = 0;
  h.sessions = [];
  h.cookies = [];
  h.ip = "203.0.113.7";
  panelLoginLimiter.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("login in panel-password mode", () => {
  beforeEach(() => {
    vi.stubEnv("PANEL_PASSWORD_HASH", panelHash);
    h.rows = [OWNER];
  });

  it("opens a session for the first active OWNER and audits it without the password", async () => {
    await expect(login({}, form({ password: PANEL_PASSWORD }))).rejects.toThrow("REDIRECT /dashboard");
    expect(h.sessions).toEqual([OWNER.id]);
    expect(h.cookies).toEqual(["kademe_session"]);
    expect(h.reads).toHaveLength(1);
    const { sql, params } = h.reads[0];
    expect(sql).toMatch(/"role" = \$1/);
    expect(params).toContain("OWNER");
    expect(sql).toMatch(/"disabled_at" is null/);
    expect(sql).toMatch(/order by "users"\."created_at" asc/);
    expect(h.inserts).toEqual([
      expect.objectContaining({ orgId: OWNER.orgId, actorId: OWNER.id, action: "auth.panel_login", subjectId: OWNER.id }),
    ]);
    expect(JSON.stringify(h.inserts)).not.toContain(PANEL_PASSWORD);
  });

  it("accepts the base64url form the hash script prints", async () => {
    vi.stubEnv("PANEL_PASSWORD_HASH", Buffer.from(panelHash).toString("base64url"));
    await expect(login({}, form({ password: PANEL_PASSWORD }))).rejects.toThrow("REDIRECT /dashboard");
    expect(h.sessions).toEqual([OWNER.id]);
  });

  it("answers a wrong password with the generic code and no session", async () => {
    await expect(login({}, form({ password: "fake-wrong-pass" }))).resolves.toEqual({ code: "INVALID" });
    expect(h.sessions).toEqual([]);
    expect(h.cookies).toEqual([]);
    expect(h.reads).toEqual([]);
  });

  it("ignores an e-mail and still asks for the panel password", async () => {
    h.rows = [{ ...OWNER, email: "someone@example.test", passwordHash: emailHash, disabledAt: null }];
    await expect(
      login({}, form({ email: "someone@example.test", password: EMAIL_PASSWORD })),
    ).resolves.toEqual({ code: "INVALID" });
    expect(h.sessions).toEqual([]);
  });

  it("refuses with the generic code when there is no active owner", async () => {
    h.rows = [];
    await expect(login({}, form({ password: PANEL_PASSWORD }))).resolves.toEqual({ code: "INVALID" });
    expect(h.sessions).toEqual([]);
  });

  it("locks a client out after 5 failures, even for the right password, and only that client", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(login({}, form({ password: `fake-wrong-${i}` }))).resolves.toEqual({ code: "INVALID" });
    }
    await expect(login({}, form({ password: PANEL_PASSWORD }))).resolves.toEqual({ code: "INVALID" });
    expect(h.sessions).toEqual([]);

    h.ip = "198.51.100.9";
    await expect(login({}, form({ password: PANEL_PASSWORD }))).rejects.toThrow("REDIRECT /dashboard");
    expect(h.sessions).toEqual([OWNER.id]);
  });

  it("does not let a forged leading X-Forwarded-For entry dodge the count", async () => {
    for (let i = 0; i < 5; i += 1) {
      h.ip = `10.0.0.${i}, 203.0.113.7`;
      await login({}, form({ password: `fake-wrong-${i}` }));
    }
    h.ip = "10.9.9.9, 203.0.113.7";
    await expect(login({}, form({ password: PANEL_PASSWORD }))).resolves.toEqual({ code: "INVALID" });
    expect(h.sessions).toEqual([]);
  });
});

describe("login in e-mail mode (PANEL_PASSWORD_HASH unset)", () => {
  beforeEach(() => {
    vi.stubEnv("PANEL_PASSWORD_HASH", "");
  });

  it("signs a user in with e-mail and password as before", async () => {
    h.rows = [{ id: "u-1", email: "manager@example.test", passwordHash: emailHash, disabledAt: null }];
    await expect(
      login({}, form({ email: "Manager@Example.test ", password: EMAIL_PASSWORD })),
    ).rejects.toThrow("REDIRECT /dashboard");
    expect(h.sessions).toEqual(["u-1"]);
    expect(h.reads[0].params).toContain("manager@example.test");
    expect(h.inserts).toEqual([]);
  });

  it("answers a wrong password with the generic code", async () => {
    h.rows = [{ id: "u-1", email: "manager@example.test", passwordHash: emailHash, disabledAt: null }];
    await expect(
      login({}, form({ email: "manager@example.test", password: "fake-wrong-pass" })),
    ).resolves.toEqual({ code: "INVALID" });
    expect(h.sessions).toEqual([]);
  });

  it("does not accept a password alone", async () => {
    await expect(login({}, form({ password: PANEL_PASSWORD }))).resolves.toEqual({ code: "INVALID" });
    expect(h.sessions).toEqual([]);
  });
});
