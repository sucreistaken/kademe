/**
 * Old URLs that still have to work for a while.
 *
 * Candidate API: a student who opened the exam before a deploy still runs the
 * old JavaScript, which calls the pre-/exam paths. These rewrites (server side,
 * no redirect, body and method intact) keep that tab working. Remove them one
 * release after the /exam move is live. The rewritten request lands on the
 * guarded exam route, so a non-exam token still gets a 404.
 */
export const LEGACY_CANDIDATE_API_REWRITES = [
  { source: "/api/c/:token/answer", destination: "/api/c/:token/exam/answer" },
  { source: "/api/c/:token/answer/commit", destination: "/api/c/:token/exam/answer/commit" },
  { source: "/api/c/:token/section/start", destination: "/api/c/:token/exam/section/start" },
  { source: "/api/c/:token/section/submit", destination: "/api/c/:token/exam/section/submit" },
  { source: "/api/c/:token/listening-audio", destination: "/api/c/:token/exam/listening-audio" },
  { source: "/api/c/:token/media/init", destination: "/api/c/:token/exam/media/init" },
];

/**
 * Panel: the exam pages moved under /exam (spec 4). Old bookmarks and links
 * pasted into chats keep working. Temporary (307) on purpose: HIRING-UX may
 * still rename the exam paths, and a cached 308 cannot be taken back.
 * `:path*` also matches the bare path, and the query string passes through.
 */
export const LEGACY_PANEL_REDIRECTS = [
  { source: "/students/:path*", destination: "/exam/students/:path*", permanent: false },
  { source: "/exams/:path*", destination: "/exam/exams/:path*", permanent: false },
  { source: "/bank/:path*", destination: "/exam/bank/:path*", permanent: false },
];
