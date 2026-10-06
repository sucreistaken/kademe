import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { hash } from "@node-rs/argon2";

vi.mock("./actions", () => ({ login: async () => ({}) }));
vi.mock("@/i18n/manager-locale", () => ({ managerLocale: async () => "tr" }));

import LoginPage from "./page";

const render = async () => renderToStaticMarkup(await LoginPage());

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("login page", () => {
  it("shows only the panel password field when PANEL_PASSWORD_HASH is set", async () => {
    vi.stubEnv("PANEL_PASSWORD_HASH", await hash("fake-panel-pass-for-tests"));
    const html = await render();
    expect(html).not.toContain('name="email"');
    expect(html.match(/<input/g)).toHaveLength(1);
    const input = html.match(/<input[^>]*>/)![0];
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
});
