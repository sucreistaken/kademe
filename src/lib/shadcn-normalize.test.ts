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

  it("leaves compound shadow utilities alone", () => {
    expect(normalizeShadcnSource('"drop-shadow-md"')).toBe('"drop-shadow-md"');
    expect(normalizeShadcnSource('"inset-shadow-sm"')).toBe('"inset-shadow-sm"');
    expect(normalizeShadcnSource('"text-shadow-lg"')).toBe('"text-shadow-lg"');
    expect(normalizeShadcnSource('"hover:shadow-lg"')).toBe('"hover:shadow-overlay"');
    expect(normalizeShadcnSource('"data-active:shadow-sm"')).toBe('"data-active:shadow-none"');
  });

  it("renames side-specific border utilities", () => {
    expect(normalizeShadcnSource('"border-b-muted"')).toBe('"border-b-muted-surface"');
    expect(normalizeShadcnSource('"border-t-accent"')).toBe('"border-t-subtle"');
    expect(normalizeShadcnSource('"hover:border-x-accent/50 border-s-accent-foreground"')).toBe(
      '"hover:border-x-subtle/50 border-s-subtle-foreground"',
    );
    expect(normalizeShadcnSource('"border-b-muted-foreground text-muted text-muted-foreground"')).toBe(
      '"border-b-muted-foreground text-muted text-muted-foreground"',
    );
  });

  it("is idempotent", () => {
    const once = normalizeShadcnSource('import { cn } from "cn"\n"bg-accent bg-muted shadow-md"');
    expect(normalizeShadcnSource(once)).toBe(once);
  });
});
