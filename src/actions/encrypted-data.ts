"use server";

import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { recordAudit } from "@/lib/utils/audit";
import { decryptField } from "@/lib/utils/encryption";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult } from "@/types";

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
 * Decrypt and return a member's driver license number.
 * Admin-only. Access is audit-logged.
 */
export async function decryptDriverLicense(
  memberId: string
): Promise<ActionResult<{ driverLicense: string }>> {
  try {
    const { adminMember } = await getAdminSession();

    const target = await db
      .select({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        driverLicenseEncrypted: member.driverLicenseEncrypted,
      })
      .from(member)
      .where(eq(member.id, memberId))
      .limit(1);

    if (!target[0]) {
      return { success: false, error: "Member not found" };
    }

    if (!target[0].driverLicenseEncrypted) {
      return { success: false, error: "No driver license on file" };
    }

    const driverLicense = decryptField(target[0].driverLicenseEncrypted);

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "encrypted_data.view_driver_license",
      entityType: "member",
      entityId: memberId,
      metadata: {
        memberName: `${target[0].firstName} ${target[0].lastName}`,
      },
    });

    return { success: true, data: { driverLicense } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
