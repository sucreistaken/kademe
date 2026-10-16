import * as React from "react";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";
import { cn } from "@/lib/cn";

const classes = (variant: "primary" | "secondary" | "ghost" | "danger", size: "sm" | "md" | "lg" = "md") =>
  cn(buttonVariants({ variant, size })).split(" ");

describe("Button's soft look (2026-10-14)", () => {
  it.each(["primary", "secondary", "ghost", "danger"] as const)("%s is round and bold, and keeps the sizes' heights", (variant) => {
    for (const [size, height] of [["sm", "h-8"], ["md", "h-10"], ["lg", "h-12"]] as const) {
      const c = classes(variant, size);
      expect(c).toContain("rounded-lg");
      expect(c.some((x) => x === "font-bold" || x === "font-extrabold")).toBe(true);
      expect(c).toContain(height);
      expect(c).toContain("disabled:cursor-not-allowed");
    }
  });

  it("primary: the brand cyan with ink text and a solid 4px lip it presses into, flat and grey when disabled", () => {
    const c = classes("primary");
    expect(c).toEqual(expect.arrayContaining(["bg-brand", "text-on-brand", "border-2", "border-brand-lip", "shadow-lip", "font-extrabold"]));
    expect(c).not.toContain("text-white");
    expect(c).toEqual(
      expect.arrayContaining(["active:not-disabled:not-aria-disabled:translate-y-[3px]", "active:not-disabled:not-aria-disabled:shadow-lip-pressed"]),
    );
    expect(c).toEqual(expect.arrayContaining(["disabled:bg-disabled", "disabled:text-muted", "disabled:border-line", "disabled:shadow-none"]));
  });

  it("secondary and danger: a white button with a 2px edge and a soft lip; neither uses red text", () => {
    for (const variant of ["secondary", "danger"] as const) {
      const c = classes(variant);
      expect(c).toEqual(expect.arrayContaining(["bg-surface", "text-ink", "border-2", "border-line-strong", "shadow-lip-soft", "disabled:shadow-none"]));
      expect(c).not.toContain("text-danger");
    }
    expect(classes("danger")).toContain("hover:border-error");
  });

  it("ghost: a text button with no lip", () => {
    const c = classes("ghost");
    expect(c).toEqual(expect.arrayContaining(["bg-transparent", "text-muted", "hover:text-ink"]));
    expect(c.some((x) => /(^|:)shadow-/.test(x))).toBe(false);
  });

  it("a caller's shadow-none really removes the lip (named shadows are known to the class merger)", () => {
    expect(cn(buttonVariants({ variant: "primary" }), "shadow-none").split(" ")).not.toContain("shadow-lip");
  });

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
