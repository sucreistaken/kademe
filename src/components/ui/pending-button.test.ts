import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const form = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", () => ({ useFormStatus: () => ({ pending: form.pending }) }));

import { PendingButton } from "./pending-button";

type Props = { type: string; variant: string; disabled: boolean; disabledReason?: string; "aria-busy"?: boolean; id?: string; children: unknown };
const render = (props: Parameters<typeof PendingButton>[0]) => PendingButton(props).props as Props;

beforeEach(() => {
  form.pending = false;
});

/**
 * One submit button for every server-action form that must not be sent twice
 * (publish, start editing, close and reopen, the undo strip): while the form
 * is on its way it says so, is disabled and aria-busy.
 */
describe("PendingButton", () => {
  it("is an enabled submit button with its label while idle", () => {
    expect(render({ label: "Yayınla", pendingLabel: "Yayınlanıyor", variant: "primary", id: "p" })).toMatchObject({
      type: "submit",
      variant: "primary",
      disabled: false,
      id: "p",
      children: "Yayınla",
    });
    expect(render({ label: "Kapat", pendingLabel: "Kapatılıyor" })["aria-busy"]).toBeUndefined();
  });

  it("while pending says so, is disabled and busy", () => {
    form.pending = true;
    expect(render({ label: "Kapat", pendingLabel: "Kapatılıyor" })).toMatchObject({ disabled: true, "aria-busy": true, children: "Kapatılıyor", variant: "secondary" });
  });

  it("with a reason stays disabled and carries the reason", () => {
    expect(render({ label: "Yayınla", pendingLabel: "Yayınlanıyor", reason: "Önce soru ekle." })).toMatchObject({ disabled: true, disabledReason: "Önce soru ekle." });
  });

  it("is the only pending submit button: no other component reads useFormStatus", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
      });
    const readers = files("src").filter((f) => readFileSync(f, "utf8").includes("useFormStatus"));
    expect(readers.map((f) => f.split(path.sep).join("/"))).toEqual(["src/components/ui/pending-button.tsx"]);
  });
});
