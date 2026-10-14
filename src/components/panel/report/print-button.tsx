"use client";

/** Opens the browser's print dialog; "Save as PDF" there makes the file. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-11 rounded-[10px] bg-accent px-5 text-[14.5px] font-semibold text-white hover:bg-accent-hover"
    >
      {label}
    </button>
  );
}
