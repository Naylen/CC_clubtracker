"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateMember } from "@/actions/members";
import { US_STATES } from "@/lib/utils/us-states";

interface MemberRecord {
  id: string;
  householdId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  dateOfBirth: string;
  role: "PRIMARY" | "DEPENDENT";
  isVeteranDisabled: boolean;
  isAdmin: boolean;
  membershipNumber: number | null;
  driverLicenseState: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
}

export function EditMemberForm({ member }: { member: MemberRecord }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      householdId: member.householdId,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: (formData.get("email") as string) || undefined,
      dateOfBirth: formData.get("dateOfBirth") as string,
      role: member.role,
      isVeteranDisabled: formData.get("isVeteranDisabled") === "on",
      isAdmin: member.isAdmin,
      driverLicenseState:
        (formData.get("driverLicenseState") as string) || undefined,
      emergencyContactName:
        (formData.get("emergencyContactName") as string) || undefined,
      emergencyContactPhone:
        (formData.get("emergencyContactPhone") as string) || undefined,
      emergencyContactRelationship:
        (formData.get("emergencyContactRelationship") as string) || undefined,
    };

    const result = await updateMember(member.id, data);

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-white p-6 space-y-5"
    >
      <h3 className="text-lg font-semibold text-gray-900">Member Details</h3>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Member updated successfully.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            First Name
          </label>
          <input
            name="firstName"
            defaultValue={member.firstName}
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Last Name
          </label>
          <input
            name="lastName"
            defaultValue={member.lastName}
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          name="email"
          type="email"
          defaultValue={member.email ?? ""}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Date of Birth
          </label>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={member.dateOfBirth}
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            DL State
          </label>
          <select
            name="driverLicenseState"
            defaultValue={member.driverLicenseState ?? ""}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">— Not set —</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          name="isVeteranDisabled"
          type="checkbox"
          defaultChecked={member.isVeteranDisabled}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label className="text-sm font-medium text-gray-700">
          Disabled Veteran (discount eligible)
        </label>
      </div>

      {/* Emergency Contact */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-semibold text-gray-800">
          Emergency Contact
        </h4>
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contact Name
            </label>
            <input
              name="emergencyContactName"
              defaultValue={member.emergencyContactName ?? ""}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contact Phone
              </label>
              <input
                name="emergencyContactPhone"
                defaultValue={member.emergencyContactPhone ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Relationship
              </label>
              <input
                name="emergencyContactRelationship"
                defaultValue={member.emergencyContactRelationship ?? ""}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Update Member"}
      </button>
    </form>
  );
}
