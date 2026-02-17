import { inngest } from "../client";
import { recordAudit } from "@/lib/utils/audit";

/**
 * Daily database backup to Google Drive.
 *
 * Cron: 7:00 UTC (2:00 AM Eastern)
 * 1. Runs pg_dump to create a compressed SQL backup
 * 2. Uploads the file to a Google Drive folder via service account
 * 3. Cleans up backups older than 30 days from Drive
 * 4. Logs the backup in the audit trail
 *
 * Required env vars:
 * - DATABASE_URL (already set)
 * - GOOGLE_SERVICE_ACCOUNT_KEY (base64-encoded JSON key)
 * - GOOGLE_DRIVE_FOLDER_ID (folder shared with the service account)
 */
export const dbBackup = inngest.createFunction(
  { id: "db-backup", name: "Daily Database Backup to Google Drive" },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    // Step 1: Create the database dump
    const dumpResult = await step.run("pg-dump", async () => {
      const { execSync } = await import("child_process");
      const { existsSync, statSync } = await import("fs");

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL not set");

      const date = new Date().toISOString().split("T")[0];
      const filename = `mcfgc-backup-${date}.sql.gz`;
      const filepath = `/tmp/${filename}`;

      // pg_dump with gzip compression
      execSync(`pg_dump "${databaseUrl}" | gzip > "${filepath}"`, {
        timeout: 120_000, // 2 minutes max
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

      return { filename, filepath, sizeBytes: stats.size };
    });

    // Step 2: Upload to Google Drive
    const uploadResult = await step.run("upload-to-drive", async () => {
      const { google } = await import("googleapis");
      const { createReadStream } = await import("fs");

      const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!keyBase64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
      if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID not set");

      // Decode service account key from base64
      const keyJson = JSON.parse(
        Buffer.from(keyBase64, "base64").toString("utf-8")
      );

      const auth = new google.auth.GoogleAuth({
        credentials: keyJson,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      const drive = google.drive({ version: "v3", auth });

      // Upload the backup file
      const response = await drive.files.create({
        requestBody: {
          name: dumpResult.filename,
          parents: [folderId],
          mimeType: "application/gzip",
        },
        media: {
          mimeType: "application/gzip",
          body: createReadStream(dumpResult.filepath),
        },
        fields: "id,name,size",
      });

      return {
        driveFileId: response.data.id!,
        driveName: response.data.name!,
      };
    });

    // Step 3: Clean up old backups (> 30 days)
    const cleanupResult = await step.run("cleanup-old-backups", async () => {
      const { google } = await import("googleapis");

      const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (!keyBase64 || !folderId) return { deleted: 0 };

      const keyJson = JSON.parse(
        Buffer.from(keyBase64, "base64").toString("utf-8")
      );

      const auth = new google.auth.GoogleAuth({
        credentials: keyJson,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      const drive = google.drive({ version: "v3", auth });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString();

      // Find old backup files in the folder
      const listResponse = await drive.files.list({
        q: `'${folderId}' in parents and name contains 'mcfgc-backup-' and createdTime < '${cutoff}' and trashed = false`,
        fields: "files(id,name,createdTime)",
        pageSize: 100,
      });

      const oldFiles = listResponse.data.files ?? [];
      let deleted = 0;

      for (const file of oldFiles) {
        try {
          await drive.files.delete({ fileId: file.id! });
          deleted++;
        } catch {
          // Non-critical — log but don't fail
          console.error(`Failed to delete old backup: ${file.name}`);
        }
      }

      return { deleted, total: oldFiles.length };
    });

    // Step 4: Clean up local temp file
    await step.run("cleanup-local", async () => {
      const { unlinkSync, existsSync } = await import("fs");
      if (existsSync(dumpResult.filepath)) {
        unlinkSync(dumpResult.filepath);
      }
    });

    // Step 5: Audit log
    await step.run("audit-log", async () => {
      await recordAudit({
        actorId: null,
        actorType: "SYSTEM",
        action: "system.db_backup",
        entityType: "system",
        entityId: "backup",
        metadata: {
          filename: dumpResult.filename,
          sizeBytes: dumpResult.sizeBytes,
          driveFileId: uploadResult.driveFileId,
          oldBackupsDeleted: cleanupResult.deleted,
        },
      });
    });

    return {
      filename: dumpResult.filename,
      sizeBytes: dumpResult.sizeBytes,
      driveFileId: uploadResult.driveFileId,
      oldBackupsDeleted: cleanupResult.deleted,
    };
  }
);
