/** HIRING-VISUAL-FLOW 3.0: the link copied is the one the candidate opened; no new token is made. */
export const candidateLink = (origin: string, token: string) => `${origin}/a/${encodeURIComponent(token)}`;

/** "copied" only when the clipboard took it; otherwise the screen shows the link to copy by hand. */
export async function copyLink(url: string, clipboard: { writeText(text: string): Promise<void> } | undefined): Promise<"copied" | "manual"> {
  if (!clipboard) return "manual";
  try {
    await clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}
