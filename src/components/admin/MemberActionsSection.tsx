"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeMember, purgeHousehold } from "@/actions/members";
import type { MembershipStatus, RemovalReason } from "@/types";

interface MemberActionsSectionProps {
  householdId: string;
  householdName: string;
  memberName: string;
  currentMembershipStatus: MembershipStatus | null;
  isSuperAdmin: boolean;
}

const REMOVAL_REASONS: { value: RemovalReason; label: string }[] = [
  { value: "RULE_VIOLATION", label: "Rule Violation" },
  { value: "VOLUNTARY_WITHDRAWAL", label: "Voluntary Withdrawal" },
  { value: "DECEASED", label: "Deceased" },
  { value: "OTHER", label: "Other" },
];

export function MemberActionsSection({
  householdId,
  householdName,
  memberName,
  currentMembershipStatus,
  isSuperAdmin,
}: MemberActionsSectionProps) {
  const router = useRouter();

  // Remove form state
  const [showRemoveForm, setShowRemoveForm] = useState(false);
  const [reason, setReason] = useState<RemovalReason>("RULE_VIOLATION");
  const [notes, setNotes] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState(false);

  // Purge form state
  const [showPurgeForm, setShowPurgeForm] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const canRemove =
    currentMembershipStatus !== null && currentMembershipStatus !== "REMOVED";

  async function handleRemove() {
    if (
      !confirm(
        `Are you sure you want to remove ${memberName}'s membership? This will mark their membership as REMOVED.`,
      )
    ) {
      return;
    }

    setRemoveError(null);
    setRemoveLoading(true);

    const result = await removeMember({
      householdId,
      reason,
      notes: notes.trim() || undefined,
    });

    setRemoveLoading(false);

    if (result.success) {
      setRemoveSuccess(true);
      setShowRemoveForm(false);
      router.refresh();
    } else {
      setRemoveError(result.error);
    }
  }

  async function handlePurge() {
    if (
      !confirm(
        `PERMANENT ACTION: This will permanently delete ALL records for "${householdName}" including members, memberships, and payments. This cannot be undone. Are you absolutely sure?`,
      )
    ) {
      return;
    }

    setPurgeError(null);
    setPurgeLoading(true);

    const result = await purgeHousehold({
      householdId,
      confirmName,
    });

    setPurgeLoading(false);

    if (result.success) {
      router.push("/admin/members");
    } else {
      setPurgeError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Remove Membership */}
      {canRemove && (
        <div>
          <h4 className="text-sm font-semibold text-red-800">
            Remove Membership
          </h4>
          <p className="mt-1 text-xs text-red-600">
            Mark this household&apos;s current-year membership as removed.
            Records are preserved for posterity.
          </p>

          {removeSuccess && (
            <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
              Membership has been removed successfully.
            </div>
          )}

          {!showRemoveForm && !removeSuccess && (
            <button
              onClick={() => setShowRemoveForm(true)}
              className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Remove Member...
            </button>
          )}

          {showRemoveForm && (
            <div className="mt-3 space-y-3">
              {removeError && (
                <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                  {removeError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value as RemovalReason)
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {REMOVAL_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Additional details..."
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRemove}
                  disabled={removeLoading}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {removeLoading ? "Removing..." : "Remove Member"}
                </button>
                <button
                  onClick={() => {
                    setShowRemoveForm(false);
                    setRemoveError(null);
                  }}
                  className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentMembershipStatus === "REMOVED" && (
        <div className="rounded-md bg-gray-100 p-3 text-sm text-gray-600">
          This household&apos;s current-year membership has already been
          removed.
        </div>
      )}

      {/* Purge Household (Super Admin only) */}
      {isSuperAdmin && (
        <div className="rounded-md border-2 border-red-300 bg-red-50 p-4">
          <h4 className="text-sm font-semibold text-red-800">
            Permanently Delete Household
          </h4>
          <p className="mt-1 text-xs text-red-600">
            This will permanently delete all records for this household
            including members, memberships, payments, and auth accounts. This
            action cannot be undone.
          </p>

          {!showPurgeForm && (
            <button
              onClick={() => setShowPurgeForm(true)}
              className="mt-3 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Permanently Delete All Records...
            </button>
          )}

          {showPurgeForm && (
            <div className="mt-3 space-y-3">
              {purgeError && (
                <div className="rounded-md bg-red-100 p-2 text-sm text-red-700">
                  {purgeError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Type &quot;{householdName}&quot; to confirm
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={householdName}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePurge}
                  disabled={
                    purgeLoading || confirmName !== householdName
                  }
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {purgeLoading
                    ? "Deleting..."
                    : "Permanently Delete All Records"}
                </button>
                <button
                  onClick={() => {
                    setShowPurgeForm(false);
                    setConfirmName("");
                    setPurgeError(null);
                  }}
                  className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
