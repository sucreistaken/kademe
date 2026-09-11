import type { SessionUser } from "./auth";

/**
 * Every manager route funnels its permission check through here rather than
 * scattering role comparisons across handlers. If a capability is not listed,
 * nobody has it.
 */
export type Capability =
  | "position:write"
  | "template:write"
  | "template:publish"
  | "candidate:invite"
  | "candidate:delete"
  | "evaluation:write"
  | "decision:write"
  | "media:view"
  | "data:export"
  | "settings:write"
  | "audit:read";

const BY_ROLE: Record<SessionUser["role"], Capability[]> = {
  OWNER: [
    "position:write",
    "template:write",
    "template:publish",
    "candidate:invite",
    "candidate:delete",
    "evaluation:write",
    "decision:write",
    "media:view",
    "data:export",
    "settings:write",
    "audit:read",
  ],
  RECRUITER: [
    "position:write",
    "template:write",
    "template:publish",
    "candidate:invite",
    "evaluation:write",
    "decision:write",
    "media:view",
  ],
  // A reviewer scores candidates and nothing else. No deletion, no export.
  REVIEWER: ["evaluation:write", "media:view"],
};

export function can(user: SessionUser, capability: Capability) {
  return BY_ROLE[user.role].includes(capability);
}

/** Digest prefix the manager error boundary matches on. */
export const FORBIDDEN_DIGEST = "FORBIDDEN";

export class ForbiddenError extends Error {
  /**
   * Next strips the message of a server-thrown error before it reaches an
   * error boundary in production, but keeps a digest the error already had.
   * Setting one here is what lets error.tsx tell "your role cannot do this"
   * apart from a real failure without leaking anything else.
   */
  readonly digest: string;

  constructor(capability: Capability) {
    super(`missing capability: ${capability}`);
    this.name = "ForbiddenError";
    this.digest = `${FORBIDDEN_DIGEST}:${capability}`;
  }
}

export function authorize(user: SessionUser, capability: Capability) {
  if (!can(user, capability)) throw new ForbiddenError(capability);
}
