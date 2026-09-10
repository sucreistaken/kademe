"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { requireUser } from "@/server/session";
import {
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  countActiveOwners,
  createSetupToken,
  findPanelUser,
  findUserByEmail,
  isRole,
  unusablePasswordHash,
  writeSettingsAudit,
  type Role,
} from "@/server/settings";

/**
 * Everything on the settings screen is a single capability: settings:write,
 * which only an OWNER has. The screen itself renders read-only for everyone
 * else, but the guard lives here as well, because a screen is not a boundary.
 */
const CAPABILITY = "settings:write" as const;

const SETTINGS = "/settings";

export async function saveOrgSettings(formData: FormData) {
  const user = await requireUser(CAPABILITY);

  const name = text(formData, "name");
  if (!name) redirect(`${SETTINGS}?error=name`);

  const mediaRetentionDays = days(formData, "mediaRetentionDays");
  const candidateRetentionDays = days(formData, "candidateRetentionDays");
  if (mediaRetentionDays === null || candidateRetentionDays === null) {
    redirect(`${SETTINGS}?error=retention`);
  }

  await db
    .update(organizations)
    .set({ name, mediaRetentionDays, candidateRetentionDays })
    .where(eq(organizations.id, user.orgId));

  await writeSettingsAudit(user, "org.update", "organization", user.orgId, {
    name,
    mediaRetentionDays,
    candidateRetentionDays,
  });

  revalidatePath(SETTINGS);
  redirect(`${SETTINGS}?saved=1`);
}

/**
 * Role changes are audited and reversible for eight seconds, like every other
 * destructive-ish act in this panel. Two things are refused outright rather
 * than undone: changing your own role, and demoting the last active owner.
 * Both of them end with nobody able to open this screen again.
 */
export async function changeUserRole(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const userId = text(formData, "userId");
  const role = text(formData, "role");
  const revert = text(formData, "revert") === "1";

  const target = await findPanelUser(user.orgId, userId);
  if (!target || !isRole(role)) redirect(SETTINGS);
  if (target.id === user.id) redirect(`${SETTINGS}?error=self`);
  if (target.role === role) redirect(SETTINGS);

  if (
    target.role === "OWNER" &&
    role !== "OWNER" &&
    (await countActiveOwners(user.orgId)) <= 1
  ) {
    redirect(`${SETTINGS}?error=lastOwner`);
  }

  await db
    .update(users)
    .set({ role })
    .where(and(eq(users.id, target.id), eq(users.orgId, user.orgId)));

  await writeSettingsAudit(user, "user.role_change", "user", target.id, {
    from: target.role,
    to: role,
    email: target.email,
    ...(revert ? { revert: true } : {}),
  });

  revalidatePath(SETTINGS);
  if (revert) redirect(SETTINGS);
  redirect(
    `${SETTINGS}?undo=role&userId=${target.id}&prev=${target.role}&next=${role}` +
      `&who=${encodeURIComponent(target.name)}`,
  );
}

/**
 * Disabled rather than deleted. A user who scored somebody last month has to
 * keep existing or that evaluation loses its author, and `resolveSession`
 * already refuses a disabled account on the next request.
 */
export async function setUserDisabled(formData: FormData) {
  const user = await requireUser(CAPABILITY);
  const userId = text(formData, "userId");
  const disabled = text(formData, "disabled") === "1";
  const revert = text(formData, "revert") === "1";

  const target = await findPanelUser(user.orgId, userId);
  if (!target) redirect(SETTINGS);
  if (target.id === user.id) redirect(`${SETTINGS}?error=self`);
  if (Boolean(target.disabledAt) === disabled) redirect(SETTINGS);

  if (
    disabled &&
    target.role === "OWNER" &&
    (await countActiveOwners(user.orgId)) <= 1
  ) {
    redirect(`${SETTINGS}?error=lastOwner`);
  }

  await db
    .update(users)
    .set({ disabledAt: disabled ? new Date() : null })
    .where(and(eq(users.id, target.id), eq(users.orgId, user.orgId)));

  await writeSettingsAudit(
    user,
    disabled ? "user.disable" : "user.enable",
    "user",
    target.id,
    { email: target.email, ...(revert ? { revert: true } : {}) },
  );

  revalidatePath(SETTINGS);
  if (revert) redirect(SETTINGS);
  redirect(
    `${SETTINGS}?undo=${disabled ? "disable" : "enable"}&userId=${target.id}` +
      `&who=${encodeURIComponent(target.name)}`,
  );
}

/**
 * Opens a panel account without anyone typing a password for somebody else.
 *
 * The row is created with an unusable password hash and a one-time link is
 * minted; the invited person sets their own password on /setup/<token>. The
 * raw link is returned once, to be rendered once, and is never written to a
 * log or an audit meta.
 */
export type InviteUserErrorCode =
  | "NAME_REQUIRED"
  | "EMAIL_INVALID"
  | "ROLE_INVALID"
  | "EMAIL_TAKEN";

export type InviteUserResult =
  | { status: "idle" }
  | { status: "error"; code: InviteUserErrorCode }
  | {
      status: "created";
      /** Shown exactly once. Only the sha256 of this reaches the database. */
      token: string;
      name: string;
      email: string;
      expiresAt: string;
      /** True when this replaced a link the owner had already handed out. */
      reissued: boolean;
    };

export async function inviteUser(
  _previous: InviteUserResult,
  formData: FormData,
): Promise<InviteUserResult> {
  const user = await requireUser(CAPABILITY);

  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role");

  if (!name) return { status: "error", code: "NAME_REQUIRED" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: "error", code: "EMAIL_INVALID" };
  }
  if (!isRole(role)) return { status: "error", code: "ROLE_INVALID" };

  const existing = await findUserByEmail(email);
  if (existing) {
    const reusable =
      existing.orgId === user.orgId && !existing.disabledAt && !existing.lastLoginAt;
    // Re-inviting an account that has never been opened is how a lost or
    // expired link is replaced. Anything else is a taken address, including an
    // account that has signed in once: that is a password reset, not an invite.
    if (!reusable) return { status: "error", code: "EMAIL_TAKEN" };
    return issue(user, existing.id, name, email, role, true);
  }

  const [created] = await db
    .insert(users)
    .values({
      orgId: user.orgId,
      email,
      name,
      passwordHash: await unusablePasswordHash(),
      role,
    })
    .returning({ id: users.id });

  return issue(user, created.id, name, email, role, false);
}

async function issue(
  actor: { id: string; orgId: string },
  userId: string,
  name: string,
  email: string,
  role: Role,
  reissued: boolean,
): Promise<InviteUserResult> {
  // The name and the role on the form win, because an account nobody has ever
  // signed into carries nothing worth protecting from a correction.
  await db.update(users).set({ name, role }).where(eq(users.id, userId));

  const link = await createSetupToken(actor.orgId, userId, actor.id);

  await writeSettingsAudit(actor, "user.invite", "user", userId, {
    email,
    role,
    ...(reissued ? { reissued: true } : {}),
  });

  revalidatePath(SETTINGS);
  return {
    status: "created",
    token: link.token,
    name,
    email,
    expiresAt: link.expiresAt.toISOString(),
    reissued,
  };
}

/* ------------------------------------------------------------------ */

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** A retention period outside the allowed window is a typo, not a policy. */
function days(formData: FormData, key: string): number | null {
  const value = Number(text(formData, key));
  if (!Number.isInteger(value)) return null;
  if (value < RETENTION_MIN_DAYS || value > RETENTION_MAX_DAYS) return null;
  return value;
}
