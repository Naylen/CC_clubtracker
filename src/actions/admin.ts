"use server";

import { db } from "@/lib/db";
import { member, account } from "@/lib/db/schema";
import { recordAudit } from "@/lib/utils/audit";
import { canManageAdmins, canModifyRole } from "@/lib/utils/rbac";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult, AdminRole } from "@/types";

/**
 * Get the current admin session with RBAC role.
 */
async function getSuperAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);

  if (!adminMember[0]?.isAdmin) throw new Error("Forbidden: Admin only");
  if (!canManageAdmins(adminMember[0].adminRole as AdminRole | null)) {
    throw new Error("Forbidden: Only Super Admins can manage admin roles");
  }

  return { session, adminMember: adminMember[0] };
}

async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);
  if (!adminMember[0]?.isAdmin) throw new Error("Forbidden: Admin only");
  return { session, adminMember: adminMember[0] };
}

/**
 * Get all admin members for the admin management page.
 */
export async function getAdminMembers() {
  await getAdminSession();
  return db
    .select({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      isAdmin: member.isAdmin,
      adminRole: member.adminRole,
      createdAt: member.createdAt,
    })
    .from(member)
    .where(eq(member.isAdmin, true))
    .orderBy(member.lastName, member.firstName);
}

/**
 * Promote a member to an admin role.
 */
export async function setAdminRole(
  memberId: string,
  role: AdminRole,
): Promise<ActionResult> {
  try {
    const { adminMember } = await getSuperAdminSession();

    // Get the target member
    const target = await db
      .select()
      .from(member)
      .where(eq(member.id, memberId))
      .limit(1);

    if (!target[0]) {
      return { success: false, error: "Member not found" };
    }

    // Cannot modify own role
    if (target[0].id === adminMember.id) {
      return { success: false, error: "Cannot modify your own admin role" };
    }

    // Check if the actor can modify this target's role
    if (
      !canModifyRole(
        adminMember.adminRole as AdminRole,
        target[0].adminRole as AdminRole | null,
      )
    ) {
      return {
        success: false,
        error: "Insufficient permissions to modify this admin's role",
      };
    }

    await db
      .update(member)
      .set({
        isAdmin: true,
        adminRole: role,
      })
      .where(eq(member.id, memberId));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "admin.set_role",
      entityType: "member",
      entityId: memberId,
      metadata: {
        name: `${target[0].firstName} ${target[0].lastName}`,
        oldRole: target[0].adminRole,
        newRole: role,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Remove admin privileges from a member.
 */
export async function removeAdminRole(
  memberId: string,
): Promise<ActionResult> {
  try {
    const { adminMember } = await getSuperAdminSession();

    const target = await db
      .select()
      .from(member)
      .where(eq(member.id, memberId))
      .limit(1);

    if (!target[0]) {
      return { success: false, error: "Member not found" };
    }

    if (target[0].id === adminMember.id) {
      return { success: false, error: "Cannot remove your own admin role" };
    }

    if (target[0].adminRole === "SUPER_ADMIN") {
      return { success: false, error: "Cannot remove Super Admin role" };
    }

    await db
      .update(member)
      .set({
        isAdmin: false,
        adminRole: null,
      })
      .where(eq(member.id, memberId));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "admin.remove_role",
      entityType: "member",
      entityId: memberId,
      metadata: {
        name: `${target[0].firstName} ${target[0].lastName}`,
        removedRole: target[0].adminRole,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Search for members that can be promoted to admin.
 */
export async function searchMembersForAdmin(query: string) {
  await getAdminSession();
  const allMembers = await db
    .select({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      isAdmin: member.isAdmin,
      adminRole: member.adminRole,
    })
    .from(member)
    .where(eq(member.isAdmin, false))
    .orderBy(member.lastName, member.firstName);

  if (!query) return allMembers.slice(0, 20);

  const lowerQuery = query.toLowerCase();
  return allMembers
    .filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(lowerQuery) ||
        (m.email ?? "").toLowerCase().includes(lowerQuery),
    )
    .slice(0, 20);
}

/**
 * Set a temporary password for a member.
 * SUPER_ADMIN only. The member will be forced to change it on next login.
 */
export async function setTempPassword(
  memberId: string,
  tempPassword: string,
): Promise<ActionResult> {
  try {
    const { adminMember } = await getSuperAdminSession();

    if (tempPassword.length < 6) {
      return {
        success: false,
        error: "Password must be at least 6 characters",
      };
    }

    // Get the target member
    const target = await db
      .select()
      .from(member)
      .where(eq(member.id, memberId))
      .limit(1);

    if (!target[0]) {
      return { success: false, error: "Member not found" };
    }

    if (!target[0].email) {
      return { success: false, error: "Member has no email address" };
    }

    // Hash the temp password using Better Auth's own hashPassword
    const { hashPassword } = await import("better-auth/crypto");
    const hashedPassword = await hashPassword(tempPassword);

    // Find or create the Better Auth user + credential account
    const { user } = await import("@/lib/db/schema");
    const { randomUUID } = await import("crypto");
    let authUser = await db
      .select()
      .from(user)
      .where(eq(user.email, target[0].email!))
      .limit(1);

    if (!authUser[0]) {
      // No auth user exists — create one so the member can log in
      const newUserId = randomUUID();
      await db.insert(user).values({
        id: newUserId,
        name: `${target[0].firstName} ${target[0].lastName}`,
        email: target[0].email!,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(account).values({
        id: randomUUID(),
        accountId: newUserId,
        providerId: "credential",
        userId: newUserId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Auth user exists — update the credential account's password
      const existingAccount = await db
        .select()
        .from(account)
        .where(
          and(
            eq(account.userId, authUser[0].id),
            eq(account.providerId, "credential"),
          ),
        )
        .limit(1);

      if (existingAccount[0]) {
        await db
          .update(account)
          .set({ password: hashedPassword })
          .where(eq(account.id, existingAccount[0].id));
      } else {
        // User exists but no credential account — create one
        await db.insert(account).values({
          id: randomUUID(),
          accountId: authUser[0].id,
          providerId: "credential",
          userId: authUser[0].id,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Set the mustChangePassword flag
    await db
      .update(member)
      .set({ mustChangePassword: true })
      .where(eq(member.id, memberId));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "admin.set_temp_password",
      entityType: "member",
      entityId: memberId,
      metadata: {
        name: `${target[0].firstName} ${target[0].lastName}`,
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
