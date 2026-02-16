import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { formatDateTimeET } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const entries = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
      <p className="mt-1 text-sm text-gray-500">
        All administrative actions and system events.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">
                Timestamp
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">Actor</th>
              <th className="px-4 py-3 font-medium text-gray-500">Action</th>
              <th className="px-4 py-3 font-medium text-gray-500">Entity</th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Metadata
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">
                  {formatDateTimeET(e.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      e.actorType === "ADMIN"
                        ? "bg-blue-100 text-blue-700"
                        : e.actorType === "SYSTEM"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {e.actorType}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {e.entityType}:{e.entityId.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {e.metadata ? JSON.stringify(e.metadata) : "—"}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
