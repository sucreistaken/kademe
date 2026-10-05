import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InfoField } from "./info-field";

const html = (error: string | null) =>
  renderToStaticMarkup(createElement(InfoField, { id: "info-email", label: "E-posta", error, type: "email", value: "elif@", onChange: () => {}, onBlur: () => {} }));

describe("a details field (3.12, review fix 1)", () => {
  it("keeps the error outside the label, so the input's name is only its label, and links it with aria-describedby", () => {
    const markup = html("Gecerli bir e-posta adresi yaz.");
    const label = markup.match(/<label[\s\S]*?<\/label>/)?.[0] ?? "";
    expect(label).toContain("E-posta");
    expect(label).not.toContain("Gecerli bir e-posta adresi yaz.");
    // positive control: the error is rendered, and its id is the one aria-describedby points at
    expect(markup).toContain("Gecerli bir e-posta adresi yaz.");
    expect(markup).toContain('id="info-email-error"');
    expect(markup).toContain('aria-describedby="info-email-error"');
    expect(markup).toContain('aria-invalid="true"');
  });

  it("shows nothing and links nothing without an error, and keeps the focus border off the error colour (fix 3)", () => {
    const quiet = html(null);
    expect(quiet).not.toContain("aria-describedby");
    expect(quiet).not.toContain("aria-invalid");
    expect(quiet).toContain("focus:border-ink/40");
    const loud = html("x");
    expect(loud).toContain("border-danger");
    expect(loud).not.toContain("focus:border-ink/40");
  });
});
