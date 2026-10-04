import type { SessionUser } from "./auth";

/**
 * Every manager route funnels its permission check through here rather than
 * scattering role comparisons across handlers. If a capability is not listed,
 * nobody has it.
 */
export type Capability =
  | "blueprint:write"
  | "bank:write"
  | "bank:approve"
  | "student:invite"
  | "student:delete"
  | "result:grade"
  | "result:finalize"
  | "integrity:decide"
  | "media:view"
  | "data:export"
  | "settings:write"
  | "audit:read"
  | "library:write"
  | "library:scale"
  | "opening:write";

const BY_ROLE: Record<SessionUser["role"], Capability[]> = {
  OWNER: [
    "blueprint:write",
    "bank:write",
    "bank:approve",
    "student:invite",
    "student:delete",
    "result:grade",
    "result:finalize",
    "integrity:decide",
    "media:view",
    "data:export",
    "settings:write",
    "audit:read",
    "library:write",
    "library:scale",
    "opening:write",
  ],
  MANAGER: [
    "blueprint:write",
    "bank:write",
    "bank:approve",
    "student:invite",
    "result:grade",
    "result:finalize",
    "integrity:decide",
    "media:view",
    "library:write",
    "opening:write",
  ],
  // A reviewer grades writing and speaking and looks at evidence. They do not
  // finalize a result, publish anything, delete or export.
  REVIEWER: ["result:grade", "media:view"],
};

/** Only the role decides; anything with a role can be asked (a session user, an opening's viewer). */
export function can(user: Pick<SessionUser, "role">, capability: Capability) {
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
