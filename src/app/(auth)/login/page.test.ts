import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { hash } from "@node-rs/argon2";

vi.mock("./actions", () => ({ login: async () => ({}) }));
const locale = vi.hoisted(() => ({ value: "tr" as "tr" | "en" | "de" | "es" }));
vi.mock("@/i18n/manager-locale", () => ({ authLocale: async () => locale.value }));

import LoginPage from "./page";

const render = async () => renderToStaticMarkup(await LoginPage());

afterEach(() => {
  vi.unstubAllEnvs();
  locale.value = "tr";
});

describe("login page", () => {
  it("shows only the panel password field when PANEL_PASSWORD_HASH is set", async () => {
    vi.stubEnv("PANEL_PASSWORD_HASH", await hash("fake-panel-pass-for-tests"));
    const html = await render();
    expect(html).not.toContain('name="email"');
    // The language picker's hidden locale inputs are not form fields.
    const fields = (html.match(/<input[^>]*>/g) ?? []).filter((tag) => !tag.includes('type="hidden"'));
    expect(fields).toHaveLength(1);
    const input = fields[0];
    expect(input).toContain('name="password"');
    expect(input).toContain('type="password"');
    expect(html).toContain("Panel şifresi");
    expect(html).toContain("Panele girmek için panel şifresini yaz.");
  });

  it("shows e-mail and password when PANEL_PASSWORD_HASH is unset", async () => {
    vi.stubEnv("PANEL_PASSWORD_HASH", "");
    const html = await render();
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain("E-posta");
    expect(html).not.toContain("Panel şifresi");
  });

  // A visitor who picked German, English or Spanish must not meet Turkish.
  it.each(["en", "de", "es"] as const)("has no Turkish text in %s", async (code) => {
    locale.value = code;
    vi.stubEnv("PANEL_PASSWORD_HASH", "");
    const html = await render();
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/[çğışİÇĞŞ]|ürünü|Giriş|Parola|Öğrenci/);
    expect(html).toContain(`lang="${code}"`);
  });
});
