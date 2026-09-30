/** Only same-origin paths may be used as a redirect target. */
export function safeBack(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export function withQuery(path: string, params: Record<string, string>): string {
  const [base, existing] = path.split("?");
  const q = new URLSearchParams(existing);
  for (const [k, v] of Object.entries(params)) q.set(k, v);
  return `${base}?${q.toString()}`;
}
