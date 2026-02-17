import Link from "next/link";
import { getBroadcasts } from "@/actions/broadcasts";
import { formatDateTimeET } from "@/lib/utils/dates";
import { CancelBroadcastButton } from "@/components/admin/CancelBroadcastButton";
import type { BroadcastStatus } from "@/types";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: BroadcastStatus }) {
  const styles: Record<BroadcastStatus, string> = {
    SENT: "bg-green-100 text-green-700",
    SCHEDULED: "bg-yellow-100 text-yellow-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  };

  const labels: Record<BroadcastStatus, string> = {
    SENT: "Sent",
    SCHEDULED: "Scheduled",
    CANCELLED: "Cancelled",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function getDisplayDate(broadcast: {
  status: string | null;
  sentAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
}): string {
  if (broadcast.status === "SENT" && broadcast.sentAt) {
    return formatDateTimeET(broadcast.sentAt);
  }
  if (broadcast.status === "SCHEDULED" && broadcast.scheduledFor) {
    return formatDateTimeET(broadcast.scheduledFor);
  }
  return formatDateTimeET(broadcast.createdAt);
}

function getDateLabel(status: string | null): string {
  if (status === "SCHEDULED") return "Scheduled";
  if (status === "CANCELLED") return "Created";
  return "Sent";
}

export default async function BroadcastsPage() {
  const broadcasts = await getBroadcasts();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Communications Log
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            History of all broadcast emails sent to members.
          </p>
        </div>
        <Link
          href="/admin/broadcasts/new"
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          New Broadcast
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 font-medium text-gray-500">Subject</th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Recipients
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">Via</th>
              <th className="px-4 py-3 font-medium text-gray-500">Filter</th>
              <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {broadcasts.map((b) => {
              const status = (b.status ?? "SENT") as BroadcastStatus;
              return (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="text-xs text-gray-400">
                      {getDateLabel(b.status)}
                    </div>
                    {getDisplayDate(b)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      status === "CANCELLED" ? "text-gray-400 line-through" : ""
                    }`}
                  >
                    {b.subject}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.recipientCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.emailProvider === "gmail"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {b.emailProvider === "gmail" ? "Gmail" : "Resend"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {JSON.stringify(b.recipientFilter)}
                  </td>
                  <td className="px-4 py-3">
                    {status === "SCHEDULED" && (
                      <CancelBroadcastButton broadcastId={b.id} />
                    )}
                  </td>
                </tr>
              );
            })}
            {broadcasts.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No broadcasts sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
