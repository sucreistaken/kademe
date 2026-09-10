"use client";

import { useRef } from "react";

/**
 * A plain GET form. Changing a dropdown submits it, so filtering never needs a
 * separate "apply" button competing with the screen's one filled button, and
 * the result stays a shareable URL.
 */
export function FilterForm({
  action,
  children,
  className = "flex flex-wrap items-center gap-2",
}: {
  action: string;
  children: React.ReactNode;
  /** Layout of the row. Y4 needs the dropdowns pushed to the far right. */
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={action}
      method="get"
      className={className}
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) ref.current?.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
