"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { approveApplication, rejectApplication } from "@/actions/memberships";
import { formatDateET } from "@/lib/utils/dates";
import { getAgeOnDate } from "@/lib/utils/pricing";

interface PendingApp {
  membershipId: string;
  memberId: string;
  householdName: string;
  householdEmail: string;
  memberFirstName: string;
  memberLastName: string;
  memberEmail: string | null;
  dateOfBirth: string;
  isVeteranDisabled: boolean;
  veteranDocFilename: string | null;
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
  membershipYear: number;
}

export function ApplicationQueue({
  applications,
  tiers,
  membershipYear,
}: ApplicationQueueProps) {
  const router = useRouter();
  const [selectedTiers, setSelectedTiers] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-select Senior tier for 65+ and Disabled Veteran tier for veterans
  useEffect(() => {
    const seniorTier = tiers.find((t) =>
      t.name.toLowerCase().includes("senior")
    );
    const veteranTier = tiers.find((t) =>
      t.name.toLowerCase().includes("veteran")
    );

    if (!seniorTier && !veteranTier) return;

    setSelectedTiers((prev) => {
      const updated = { ...prev };
      let changed = false;

      for (const app of applications) {
        // Skip if already selected
        if (updated[app.membershipId]) continue;

        // Veteran discount takes priority (BR-5)
        if (app.isVeteranDisabled && veteranTier) {
          updated[app.membershipId] = veteranTier.id;
          changed = true;
          continue;
        }

        // Senior 65+
        if (seniorTier) {
          const age = getAgeOnDate(
            app.dateOfBirth,
            `${membershipYear}-01-01`
          );
          if (age >= 65) {
            updated[app.membershipId] = seniorTier.id;
            changed = true;
          }
        }
      }

      return changed ? updated : prev;
    });
  }, [applications, tiers, membershipYear]);

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
              <th className="px-4 py-3 font-medium text-gray-700">Age</th>
              <th className="px-4 py-3 font-medium text-gray-700">Veteran</th>
              <th className="px-4 py-3 font-medium text-gray-700">Applied</th>
              <th className="px-4 py-3 font-medium text-gray-700">
                Assign Tier
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {applications.map((app) => {
              const age = getAgeOnDate(
                app.dateOfBirth,
                `${membershipYear}-01-01`
              );
              return (
                <tr key={app.membershipId}>
                  <td className="px-4 py-3 font-medium">
                    {app.memberFirstName} {app.memberLastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {app.memberEmail ?? app.householdEmail}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{app.dateOfBirth}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        age >= 65
                          ? "font-semibold text-blue-700"
                          : "text-gray-600"
                      }
                    >
                      {age}
                    </span>
                    {age >= 65 && (
                      <span className="ml-1 inline-flex rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        65+
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {app.isVeteranDisabled ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Yes
                        </span>
                        {app.veteranDocFilename ? (
                          <a
                            href={`/api/admin/veteran-doc/${app.memberId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200"
                          >
                            View Doc
                          </a>
                        ) : (
                          <span className="text-xs text-red-600">No doc</span>
                        )}
                      </div>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
