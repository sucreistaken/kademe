/** New screens use the 12px card of HIRING-UX 8.3, set once here (RULES.md shadcn section). */
export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ "--card-radius": "12px" } as React.CSSProperties}>{children}</div>;
}
