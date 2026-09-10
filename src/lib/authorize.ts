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

export class ForbiddenError extends Error {
  constructor(capability: Capability) {
    super(`missing capability: ${capability}`);
    this.name = "ForbiddenError";
  }
}

export function authorize(user: SessionUser, capability: Capability) {
  if (!can(user, capability)) throw new ForbiddenError(capability);
}
