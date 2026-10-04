import { describe, expect, it } from "vitest";
import { KADEME_OWNED, NORMALIZED_HOOKS, isKademeOwned, normalizeShadcnSource } from "./shadcn-normalize";

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

  it("drops the focus rings that would double the global focus outline", () => {
    expect(
      normalizeShadcnSource('"border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 text-sm"'),
    ).toBe('"border focus-visible:border-ring text-sm"');
    expect(normalizeShadcnSource('"px-1 focus-visible:ring-[3px] focus-visible:ring-ring/50"')).toBe('"px-1"');
    expect(normalizeShadcnSource('"ring-sidebar-ring outline-hidden focus-visible:ring-2 [&>svg]:size-4"')).toBe(
      '"ring-sidebar-ring outline-hidden [&>svg]:size-4"',
    );
  });

  it("drops them at the start, at the end and as the only class", () => {
    expect(normalizeShadcnSource('"focus-visible:ring-3 border"')).toBe('"border"');
    expect(normalizeShadcnSource('"border focus-visible:ring-3"')).toBe('"border"');
    expect(normalizeShadcnSource('"focus-visible:ring-2"')).toBe('""');
    expect(normalizeShadcnSource("cn('focus-visible:ring-2', `a focus-visible:ring-ring/50`)")).toBe("cn('', `a`)");
  });

  it("drops focus rings drawn through has-[...:focus-visible] on a wrapper", () => {
    expect(
      normalizeShadcnSource(
        '"has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 h-10"',
      ),
    ).toBe('"has-[[data-slot=input-group-control]:focus-visible]:border-ring h-10"');
    expect(normalizeShadcnSource('"has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 p-2"')).toBe('"p-2"');
  });

  it("keeps the invalid-state rings and other focus utilities", () => {
    const src =
      '"aria-invalid:ring-3 aria-invalid:ring-destructive/20 focus-visible:ring-0 focus-visible:outline-1 group-has-[:focus-visible]/field-label:ring-0 ring-3"';
    expect(normalizeShadcnSource(src)).toBe(src);
  });

  it("is idempotent", () => {
    const once = normalizeShadcnSource(
      'import { cn } from "cn"\n"bg-accent bg-muted shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 x"',
    );
    expect(normalizeShadcnSource(once)).toBe(once);
  });
});

describe("which files the normalizer owns", () => {
  it("skips the Kademe primitives by name", () => {
    for (const name of ["button.tsx", "card.tsx", "status-dot.tsx", "undo-strip.tsx", "inline-link.tsx", "avatar.tsx"]) {
      expect(KADEME_OWNED.has(name), name).toBe(true);
      expect(isKademeOwned(name, "export {}\n"), name).toBe(true);
    }
  });

  it("skips any file whose first line is the kademe-owned header", () => {
    expect(isKademeOwned("meter.tsx", "// kademe-owned\nexport {}\n")).toBe(true);
    expect(isKademeOwned("meter.tsx", '"use client"\n// kademe-owned\n')).toBe(false);
    expect(isKademeOwned("input.tsx", '"use client"\n')).toBe(false);
  });

  it("rewrites only the hooks the shadcn CLI copied", () => {
    expect(NORMALIZED_HOOKS).toEqual(["use-mobile.ts"]);
  });
});
