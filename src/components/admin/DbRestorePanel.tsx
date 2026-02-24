"use client";

import { useState, useCallback } from "react";
import { getBackupList, restoreFromBackup } from "@/actions/db-restore";
import type { BackupFile } from "@/lib/utils/db-restore";

export function DbRestorePanel() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Confirmation modal state
  const [confirmTarget, setConfirmTarget] = useState<BackupFile | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getBackupList();
    if (result.success) {
      setBackups(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
    setFetched(true);
  }, []);

  async function handleRestore() {
    if (!confirmTarget) return;

    setRestoring(true);
    setError(null);
    setSuccess(null);

    const result = await restoreFromBackup({
      fileId: confirmTarget.id,
      fileName: confirmTarget.name,
      confirmationText: confirmText,
    });

    setRestoring(false);
    setConfirmTarget(null);
    setConfirmText("");

    if (result.success) {
      setSuccess(
        "Database restored successfully. The page will reload in 3 seconds..."
      );
      setTimeout(() => window.location.reload(), 3000);
    } else {
      setError(result.error);
    }
  }

  const expectedDate = confirmTarget
    ? confirmTarget.name.match(/mcfgc-backup-(\d{4}-\d{2}-\d{2})/)?.[1] ?? ""
    : "";

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="rounded-lg border border-red-300 bg-red-50 p-4">
        <h3 className="text-sm font-bold text-red-800">
          Destructive Operation Warning
        </h3>
        <p className="mt-1 text-sm text-red-700">
          Restoring a database backup will <strong>permanently replace</strong>{" "}
          the current database with the backup contents. All data created after
          the backup date will be lost. This action cannot be undone.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Fetch / Refresh button */}
      <div className="flex items-center gap-3">
        <button
          onClick={fetchBackups}
          disabled={loading || restoring}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? "Loading..." : fetched ? "Refresh List" : "Load Backups"}
        </button>
        {fetched && !loading && (
          <span className="text-sm text-gray-500">
            {backups.length} backup{backups.length !== 1 ? "s" : ""} found
          </span>
        )}
      </div>

      {/* Backup table */}
      {fetched && backups.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">
                  Backup Date
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">
                  Filename
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">Size</th>
                <th className="px-4 py-3 font-medium text-gray-500">
                  Created
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {backup.backupDate}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {backup.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{backup.size}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(backup.createdTime).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setConfirmTarget(backup);
                        setConfirmText("");
                      }}
                      disabled={restoring}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fetched && !loading && backups.length === 0 && (
        <p className="text-sm text-gray-500">
          No backup files found in Google Drive.
        </p>
      )}

      {/* Confirmation modal */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => !restoring && setConfirmTarget(null)}
            aria-hidden="true"
          />
          <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-red-800">
              Confirm Database Restore
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              You are about to restore the database from:
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-gray-900">
              {confirmTarget.name}
            </p>
            <p className="mt-3 text-sm text-red-700">
              This will <strong>permanently destroy</strong> all current data and
              replace it with the backup from{" "}
              <strong>{confirmTarget.backupDate}</strong>.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Type <span className="font-mono font-bold">{expectedDate}</span>{" "}
                to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={restoring}
                placeholder={expectedDate}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                disabled={restoring}
                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={confirmText !== expectedDate || restoring}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {restoring ? "Restoring..." : "Restore Database"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
