import { cn } from "@/lib/cn";

/**
 * A notice: something the reader must know or fix (DESIGN.md notice-warn,
 * notice-neutral). Yellow-soft with ink text and a small yellow "!" tile for
 * a warning or an error message; cream for a neutral note. Never red: red is
 * reserved for the brand, the recording dot and a field's error frame.
 */
export const NOTICE_CLASS = {
  warn: "flex items-start gap-3 rounded-lg border-2 border-yellow-soft-lip bg-yellow-soft px-4 py-3 text-[14.5px] font-semibold leading-[1.5] text-ink",
  neutral: "flex items-start gap-3 rounded-lg border-2 border-line bg-cream px-4 py-3 text-[14.5px] font-semibold leading-[1.5] text-ink",
} as const;

export function Notice({
  tone = "warn",
  role,
  className,
  children,
}: {
  tone?: keyof typeof NOTICE_CLASS;
  role?: "alert" | "status";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p role={role} className={cn(NOTICE_CLASS[tone], className)}>
      {tone === "warn" ? (
        <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] bg-yellow text-[13px] font-black text-ink">
          !
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}
