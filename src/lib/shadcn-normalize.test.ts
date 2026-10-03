import { describe, expect, it } from "vitest";
import { normalizeShadcnSource } from "./shadcn-normalize";

describe("normalizeShadcnSource", () => {
  it("routes cn to the project helper", () => {
    expect(normalizeShadcnSource('import { cn } from "cn"\n')).toBe('import { cn } from "@/lib/cn"\n');
  });

  it("renames shadcn accent to subtle, keeping variants and opacity", () => {
    const src = '"focus:bg-accent focus:text-accent-foreground data-open:bg-accent hover:bg-accent/50"';
    expect(normalizeShadcnSource(src)).toBe(
      '"focus:bg-subtle focus:text-subtle-foreground data-open:bg-subtle hover:bg-subtle/50"',
    );
  });

  it("renames the muted background but leaves muted-foreground alone", () => {
    const src = '"bg-muted bg-muted/50 text-muted-foreground hover:bg-muted"';
    expect(normalizeShadcnSource(src)).toBe(
      '"bg-muted-surface bg-muted-surface/50 text-muted-foreground hover:bg-muted-surface"',
    );
  });

  it("leaves text-muted alone: in Kademe it already means grey text", () => {
    expect(normalizeShadcnSource('"text-muted"')).toBe('"text-muted"');
  });

  it("does not touch the sidebar tokens", () => {
    const src = '"bg-sidebar-accent text-sidebar-accent-foreground"';
    expect(normalizeShadcnSource(src)).toBe(src);
  });

  it("turns overlay shadows into the overlay token and drops small shadows", () => {
    expect(normalizeShadcnSource('"shadow-md"')).toBe('"shadow-overlay"');
    expect(normalizeShadcnSource('"shadow-lg"')).toBe('"shadow-overlay"');
    expect(normalizeShadcnSource('"data-active:shadow-sm"')).toBe('"data-active:shadow-none"');
    expect(normalizeShadcnSource('"shadow-none"')).toBe('"shadow-none"');
  });

  it("is idempotent", () => {
    const once = normalizeShadcnSource('import { cn } from "cn"\n"bg-accent bg-muted shadow-md"');
    expect(normalizeShadcnSource(once)).toBe(once);
  });
});
