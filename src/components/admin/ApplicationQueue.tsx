"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveApplication, rejectApplication } from "@/actions/memberships";
import { formatDateET } from "@/lib/utils/dates";

interface PendingApp {
  membershipId: string;
  householdName: string;
  householdEmail: string;
  memberFirstName: string;
  memberLastName: string;
  memberEmail: string | null;
  dateOfBirth: string;
  isVeteranDisabled: boolean;
  createdAt: Date;
}

interface Tier {
  id: string;
  name: string;
  priceCents: number;
}

interface ApplicationQueueProps {
  applications: PendingApp[];
  tiers: Tier[];
}

export function ApplicationQueue({
  applications,
  tiers,
}: ApplicationQueueProps) {
  const router = useRouter();
  const [selectedTiers, setSelectedTiers] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(membershipId: string) {
    const tierId = selectedTiers[membershipId];
    if (!tierId) {
      setError("Please select a membership tier before approving.");
      return;
    }

    setError(null);
    setLoading(membershipId);

    const result = await approveApplication(membershipId, tierId);

    setLoading(null);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleReject(membershipId: string) {
    if (!confirm("Are you sure you want to reject this application? This will delete the applicant's records.")) {
      return;
    }

    setError(null);
    setLoading(membershipId);

    const result = await rejectApplication(membershipId);

    setLoading(null);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-md border bg-gray-50 p-6 text-center text-sm text-gray-500">
        No pending applications.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">
                Applicant
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">Email</th>
              <th className="px-4 py-3 font-medium text-gray-700">DOB</th>
              <th className="px-4 py-3 font-medium text-gray-700">Veteran</th>
              <th className="px-4 py-3 font-medium text-gray-700">Applied</th>
              <th className="px-4 py-3 font-medium text-gray-700">
                Assign Tier
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {applications.map((app) => (
              <tr key={app.membershipId}>
                <td className="px-4 py-3 font-medium">
                  {app.memberFirstName} {app.memberLastName}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {app.memberEmail ?? app.householdEmail}
                </td>
                <td className="px-4 py-3 text-gray-600">{app.dateOfBirth}</td>
                <td className="px-4 py-3">
                  {app.isVeteranDisabled ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Yes
                    </span>
                  ) : (
                    "No"
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDateET(app.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={selectedTiers[app.membershipId] ?? ""}
                    onChange={(e) =>
                      setSelectedTiers((prev) => ({
                        ...prev,
                        [app.membershipId]: e.target.value,
                      }))
                    }
                    className="w-full rounded-md border px-2 py-1 text-sm"
                  >
                    <option value="">Select tier...</option>
                    {tiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} (${(tier.priceCents / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(app.membershipId)}
                      disabled={
                        loading === app.membershipId ||
                        !selectedTiers[app.membershipId]
                      }
                      className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading === app.membershipId
                        ? "..."
                        : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReject(app.membershipId)}
                      disabled={loading === app.membershipId}
                      className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
