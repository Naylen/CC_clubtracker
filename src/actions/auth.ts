"use server";

import { db } from "@/lib/db";
import { member, account } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult } from "@/types";

/**
 * Change the current user's password and clear the mustChangePassword flag.
 * Used after a temp password is set by an admin.
 */
export async function changePassword(
  newPassword: string
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return { success: false, error: "Not authenticated" };
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    }

    // Hash the new password using Better Auth's crypto
    const { hashPassword } = await import("better-auth/crypto");
    const hashedPassword = await hashPassword(newPassword);

    // Update the credential account's password
    await db
      .update(account)
      .set({ password: hashedPassword })
      .where(
        and(
          eq(account.userId, session.user.id),
          eq(account.providerId, "credential")
        )
      );

    // Clear mustChangePassword flag on the member record
    const memberRecord = await db
      .select()
      .from(member)
      .where(eq(member.email, session.user.email))
      .limit(1);

    if (memberRecord[0]) {
      await db
        .update(member)
        .set({ mustChangePassword: false })
        .where(eq(member.id, memberRecord[0].id));
    }

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if the current logged-in user must change their password.
 */
export async function checkMustChangePassword(): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return false;

    const memberRecord = await db
      .select({ mustChangePassword: member.mustChangePassword })
      .from(member)
      .where(eq(member.email, session.user.email))
      .limit(1);

    return memberRecord[0]?.mustChangePassword ?? false;
  } catch {
    return false;
  }
}
