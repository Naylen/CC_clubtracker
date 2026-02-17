import { execSync } from "child_process";
import { existsSync, statSync, unlinkSync, createReadStream } from "fs";
import { google } from "googleapis";
import { recordAudit } from "@/lib/utils/audit";

/**
 * Daily database backup to Google Drive.
 *
 * 1. Runs pg_dump to create a compressed SQL backup
 * 2. Uploads the file to a Google Drive folder via service account
 * 3. Cleans up backups older than 30 days from Drive
 * 4. Logs the backup in the audit trail
 */
export async function runDbBackup(): Promise<{
  filename: string;
  sizeBytes: number;
  driveFileId: string;
  oldBackupsDeleted: number;
}> {
  // Step 1: pg_dump
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  const date = new Date().toISOString().split("T")[0];
  const filename = `mcfgc-backup-${date}.sql.gz`;
  const filepath = `/tmp/${filename}`;

  execSync(`pg_dump "${databaseUrl}" | gzip > "${filepath}"`, {
    timeout: 120_000,
    stdio: "pipe",
  });

  if (!existsSync(filepath)) {
    throw new Error("pg_dump failed — output file not created");
  }

  const stats = statSync(filepath);
  if (stats.size < 100) {
    throw new Error(
      `pg_dump produced suspiciously small file (${stats.size} bytes)`
    );
  }

  // Step 2: Upload to Google Drive
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!keyBase64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID not set");

  const keyJson = JSON.parse(
    Buffer.from(keyBase64, "base64").toString("utf-8")
  );

  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: "application/gzip",
    },
    media: {
      mimeType: "application/gzip",
      body: createReadStream(filepath),
    },
    fields: "id,name,size",
    supportsAllDrives: true,
  });

  const driveFileId = response.data.id!;

  // Step 3: Clean up old backups (> 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  const listResponse = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'mcfgc-backup-' and createdTime < '${cutoff}' and trashed = false`,
    fields: "files(id,name,createdTime)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });

  const oldFiles = listResponse.data.files ?? [];
  let deleted = 0;

  for (const file of oldFiles) {
    try {
      await drive.files.delete({ fileId: file.id!, supportsAllDrives: true });
      deleted++;
    } catch {
      console.error(`Failed to delete old backup: ${file.name}`);
    }
  }

  // Step 4: Clean up local temp file
  if (existsSync(filepath)) {
    unlinkSync(filepath);
  }

  // Step 5: Audit log
  await recordAudit({
    actorId: null,
    actorType: "SYSTEM",
    action: "system.db_backup",
    entityType: "system",
    entityId: "00000000-0000-0000-0000-000000000000",
    metadata: {
      filename,
      sizeBytes: stats.size,
      driveFileId,
      oldBackupsDeleted: deleted,
    },
  });

  return { filename, sizeBytes: stats.size, driveFileId, oldBackupsDeleted: deleted };
}
