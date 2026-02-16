"use server";

import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { recordAudit } from "@/lib/utils/audit";
import { canManageAdmins, canModifyRole } from "@/lib/utils/rbac";
import { eq } from "drizzle-orm";
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

/**
 * Get all admin members for the admin management page.
 */
export async function getAdminMembers() {
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
