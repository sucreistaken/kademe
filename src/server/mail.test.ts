import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { mailConfig, outgoingBody } from "./mail";

describe("mailConfig", () => {
  it("is off without host, user and password", () => {
    expect(mailConfig({})).toBeNull();
    expect(mailConfig({ SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "exam@campusgerman.com" })).toBeNull();
  });

  it("defaults to port 465 over TLS and sends from the SMTP user", () => {
    expect(mailConfig({ SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "exam@campusgerman.com", SMTP_PASS: "x" })).toEqual({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      user: "exam@campusgerman.com",
      pass: "x",
      from: "exam@campusgerman.com",
    });
  });

  it("takes port 587 as STARTTLS and a named sender", () => {
    const c = mailConfig({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p", SMTP_PORT: "587", MAIL_FROM: "Campus German <exam@campusgerman.com>" });
    expect(c).toMatchObject({ port: 587, secure: false, from: "Campus German <exam@campusgerman.com>" });
  });
});

describe("outgoingBody", () => {
  const row = { toEmail: "elif@ornek.com", body: "Başlamak için: {{link:a1}}\n\nBilgisayarda açın." };

  it("puts the link where the placeholder stands", () => {
    expect(outgoingBody(row, { id: "m1", assessmentId: "a1", link: "https://k/a/tok" })).toEqual({ ok: true, body: "Başlamak için: https://k/a/tok\n\nBilgisayarda açın." });
  });

  it("never sends a body that still holds a placeholder", () => {
    expect(outgoingBody(row, { id: "m1" })).toEqual({ ok: false, error: "NO_LINK" });
    expect(outgoingBody(row, { id: "m1", assessmentId: "other", link: "https://k/a/tok" })).toEqual({ ok: false, error: "NO_LINK" });
  });

  it("does not mail a placeholder address", () => {
    expect(outgoingBody({ toEmail: "okul@kademe.local", body: "x" }, { id: "m1" })).toEqual({ ok: false, error: "NO_ADDRESS" });
  });
});
