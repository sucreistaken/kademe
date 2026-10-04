import * as React from "react";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";
import { cn } from "@/lib/cn";

/** The exact strings the pre-shadcn Button produced (commit a99b878). */
const BEFORE = {
  base: "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed select-none",
  primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas disabled:text-muted disabled:hover:bg-surface",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-line/50 disabled:text-line",
  danger: "bg-surface text-danger border border-line hover:bg-danger/5 disabled:text-muted",
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
} as const;

describe("Button keeps its classes", () => {
  for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
    for (const size of ["sm", "md", "lg"] as const) {
      it(`${variant} ${size}`, () => {
        expect(cn(buttonVariants({ variant, size }))).toBe(cn(BEFORE.base, BEFORE[variant], BEFORE[size]));
      });
    }
  }

  it("outline is the secondary look", () => {
    expect(cn(buttonVariants({ variant: "outline", size: "md" }))).toBe(
      cn(buttonVariants({ variant: "secondary", size: "md" })),
    );
  });
});

type Props = React.ComponentProps<typeof Button>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = React.ReactElement<Record<string, any>>;
/** Button is a plain function component, so calling it shows the element it renders. */
const render = (props: Props) => Button(props) as AnyElement;

describe("Button asChild", () => {
  it("passes every prop the caller or a Radix trigger gives it to the child", () => {
    const el = render({
      asChild: true,
      variant: "primary",
      id: "go",
      title: "Open",
      "aria-expanded": true,
      "aria-haspopup": "menu",
      "data-state": "open",
      tabIndex: 0,
      children: React.createElement("a", { href: "/students/new" }, "Invite"),
    } as Props);
    expect(el.type).toBe("a");
    expect(el.props.href).toBe("/students/new");
    expect(el.props.id).toBe("go");
    expect(el.props.title).toBe("Open");
    expect(el.props["aria-expanded"]).toBe(true);
    expect(el.props["aria-haspopup"]).toBe("menu");
    expect(el.props["data-state"]).toBe("open");
    expect(el.props.tabIndex).toBe(0);
    expect(el.props["data-slot"]).toBe("button");
    expect(el.props["data-variant"]).toBe("primary");
  });

  it("runs both the child's handler and the slot's handler, child first", () => {
    const calls: string[] = [];
    const el = render({
      asChild: true,
      onClick: () => calls.push("slot"),
      onKeyDown: () => calls.push("slot-key"),
      children: React.createElement("a", { href: "/", onClick: () => calls.push("child") }),
    });
    el.props.onClick({});
    el.props.onKeyDown({});
    expect(calls).toEqual(["child", "slot", "slot-key"]);
  });

  it("hands the DOM node to both the slot's ref and the child's ref", () => {
    const slotRef = React.createRef<HTMLButtonElement>();
    let childNode: unknown = null;
    const el = render({
      asChild: true,
      ref: slotRef,
      children: React.createElement("a", { href: "/", ref: (node: unknown) => (childNode = node) }),
    });
    const node = { tagName: "A" };
    el.props.ref(node);
    expect(slotRef.current).toBe(node);
    expect(childNode).toBe(node);
  });

  it("merges classes with tailwind-merge, the child's winning", () => {
    const el = render({
      asChild: true,
      size: "md",
      className: "w-full",
      children: React.createElement("a", { href: "/", className: "h-12" }),
    });
    expect(el.props.className).toBe(cn(buttonVariants({ variant: "secondary", size: "md" }), "w-full", "h-12"));
    expect(el.props.className.split(" ").filter((c: string) => c === "h-12")).toHaveLength(1);
    expect(el.props.className).not.toContain("h-10");
  });
});

describe("Button disabled reason", () => {
  it("does not invent an id when the button has none", () => {
    const el = render({ disabled: true, disabledReason: "Checking", children: "Sign in" });
    expect(el.props["aria-describedby"]).toBeUndefined();
  });

  it("points at <id>-why when it has an id and a reason", () => {
    const el = render({ id: "save", disabled: true, disabledReason: "Read only", children: "Save" });
    expect(el.props["aria-describedby"]).toBe("save-why");
  });

  it("keeps the caller's aria-describedby and adds the reason to it", () => {
    const el = render({
      id: "save",
      disabled: true,
      disabledReason: "Read only",
      "aria-describedby": "save-hint",
      children: "Save",
    });
    expect(el.props["aria-describedby"]).toBe("save-hint save-why");
  });

  it("keeps the caller's aria-describedby on an enabled button", () => {
    const el = render({ id: "save", disabledReason: "Read only", "aria-describedby": "save-hint", children: "Save" });
    expect(el.props["aria-describedby"]).toBe("save-hint");
  });

  it("still renders a real button that does not submit by default", () => {
    const el = render({ disabled: true, disabledReason: "Read only", children: "Save" });
    expect(el.type).toBe("button");
    expect(el.props.type).toBe("button");
    expect(el.props.disabled).toBe(true);
  });
});
