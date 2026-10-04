/**
 * The seed scripts write to whatever DATABASE_URL names, so they only run
 * against the local Docker database on port 5434 and never against `kademe`,
 * which other sessions share. Returns the reason to refuse, or null when the
 * url is the local working database. Pure so a unit test can pin it.
 */
export function refuseUnlessWorkingDb(rawUrl: string | undefined): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl ?? "");
  } catch {
    return "DATABASE_URL is missing or not a valid url.";
  }
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    return `not a local database (${url.hostname}).`;
  }
  if (url.port !== "5434") {
    return `not the local database on port 5434 (port ${url.port || "default"}).`;
  }
  if (url.pathname === "/kademe") {
    return "kademe is the shared database. Use kademe_platform.";
  }
  return null;
}
