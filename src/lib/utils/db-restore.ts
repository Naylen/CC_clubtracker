import { execFileSync } from "child_process";
import { existsSync, unlinkSync, createWriteStream } from "fs";
import { google } from "googleapis";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export interface BackupFile {
  id: string;
  name: string;
  sizeBytes: number;
  size: string;
  createdTime: string;
  backupDate: string;
}

function getDriveClient() {
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
  return { drive, folderId };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * List available backup files from Google Drive, newest first.
 */
export async function listDriveBackups(): Promise<BackupFile[]> {
  const { drive, folderId } = getDriveClient();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'mcfgc-backup-' and trashed = false`,
    orderBy: "createdTime desc",
    pageSize: 50,
    fields: "files(id,name,size,createdTime)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });

  const files = response.data.files ?? [];

  return files.map((f) => {
    const sizeBytes = Number(f.size ?? 0);
    // Extract date from filename like mcfgc-backup-2026-02-24.sql.gz
    const dateMatch = f.name?.match(/mcfgc-backup-(\d{4}-\d{2}-\d{2})/);
    return {
      id: f.id!,
      name: f.name!,
      sizeBytes,
      size: formatFileSize(sizeBytes),
      createdTime: f.createdTime!,
      backupDate: dateMatch ? dateMatch[1] : "unknown",
    };
  });
}

/**
 * Download a backup from Google Drive and restore it to the database.
 *
 * Uses execFileSync (no shell) to avoid injection risk.
 * Three-step restore: drop schema → gunzip → psql restore.
 */
export async function downloadAndRestore(
  fileId: string,
  fileName: string
): Promise<void> {
  // Strict filename validation
  if (!/^mcfgc-backup-\d{4}-\d{2}-\d{2}\.sql\.gz$/.test(fileName)) {
    throw new Error(`Invalid backup filename: ${fileName}`);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  const gzPath = `/tmp/${fileName}`;
  const sqlPath = gzPath.replace(/\.gz$/, "");

  try {
    // Step 1: Download file from Drive
    const { drive } = getDriveClient();

    const downloadResponse = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    );

    const readable = downloadResponse.data as unknown as Readable;
    await pipeline(readable, createWriteStream(gzPath));

    if (!existsSync(gzPath)) {
      throw new Error("Download failed — file not written to disk");
    }

    // Step 2: Drop and recreate public schema
    console.log("[db-restore] Dropping and recreating public schema...");
    execFileSync("psql", [databaseUrl, "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"], {
      timeout: 60_000,
    });

    // Step 3: Decompress
    console.log("[db-restore] Decompressing backup...");
    execFileSync("gunzip", ["-k", "-f", gzPath], {
      timeout: 120_000,
    });

    if (!existsSync(sqlPath)) {
      throw new Error("Decompression failed — SQL file not created");
    }

    // Step 4: Restore
    console.log("[db-restore] Restoring database from backup...");
    execFileSync("psql", [databaseUrl, "-f", sqlPath], {
      timeout: 300_000, // 5 minutes
      maxBuffer: 100 * 1024 * 1024,
    });

    console.log(`[db-restore] Successfully restored from ${fileName}`);
  } finally {
    // Cleanup temp files
    if (existsSync(gzPath)) unlinkSync(gzPath);
    if (existsSync(sqlPath)) unlinkSync(sqlPath);
  }
}
