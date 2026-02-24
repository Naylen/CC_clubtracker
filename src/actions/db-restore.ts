"use server";

import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/utils/audit";
import { restoreBackupSchema } from "@/lib/validators/db-restore";
import { listDriveBackups, downloadAndRestore } from "@/lib/utils/db-restore";
import type { ActionResult } from "@/types";
import type { BackupFile } from "@/lib/utils/db-restore";

async function requireSuperAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);

  if (!adminMember[0]?.isAdmin || adminMember[0].adminRole !== "SUPER_ADMIN") {
    throw new Error("Forbidden: Super Admin only");
  }

  return { session, adminMember: adminMember[0] };
}

/**
 * List available backups from Google Drive.
 */
export async function getBackupList(): Promise<ActionResult<BackupFile[]>> {
  try {
    await requireSuperAdmin();
    const backups = await listDriveBackups();
    return { success: true, data: backups };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Restore database from a Google Drive backup.
 */
export async function restoreFromBackup(
  input: unknown
): Promise<ActionResult> {
  try {
    const { adminMember } = await requireSuperAdmin();

    // Validate input
    const parsed = restoreBackupSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { fileId, fileName, confirmationText } = parsed.data;

    // Validate confirmation text matches backup date
    const dateMatch = fileName.match(/mcfgc-backup-(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) {
      return { success: false, error: "Invalid backup filename format" };
    }

    if (confirmationText !== dateMatch[1]) {
      return {
        success: false,
        error: "Confirmation text does not match the backup date",
      };
    }

    // Audit log before restore (will be destroyed by the restore itself)
    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "admin.db_restore",
      entityType: "system",
      entityId: "00000000-0000-0000-0000-000000000000",
      metadata: {
        fileName,
        fileId,
        backupDate: dateMatch[1],
      },
    });

    // Console log is the durable record since the DB gets replaced
    console.log(
      `[db-restore] RESTORE INITIATED by ${adminMember.firstName} ${adminMember.lastName} (${adminMember.email}) — file: ${fileName}, driveId: ${fileId}`
    );

    await downloadAndRestore(fileId, fileName);

    console.log(`[db-restore] RESTORE COMPLETED — file: ${fileName}`);

    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during restore";
    console.error(`[db-restore] RESTORE FAILED — ${message}`);
    return { success: false, error: message };
  }
}
