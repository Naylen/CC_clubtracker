"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateMyProfile } from "@/actions/member-portal";
import { US_STATES } from "@/lib/utils/us-states";

interface EditMyProfileFormProps {
  member: {
    firstName: string;
    lastName: string;
    email: string | null;
    dateOfBirth: string;
    isVeteranDisabled: boolean;
    membershipNumber: number | null;
    driverLicenseState: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelationship: string | null;
  };
}

export function EditMyProfileForm({ member }: EditMyProfileFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
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
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: (formData.get("email") as string) || undefined,
      dateOfBirth: formData.get("dateOfBirth") as string,
      isVeteranDisabled: formData.get("isVeteranDisabled") === "on",
      driverLicenseState:
        (formData.get("driverLicenseState") as string) || undefined,
      emergencyContactName:
        (formData.get("emergencyContactName") as string) || undefined,
      emergencyContactPhone:
        (formData.get("emergencyContactPhone") as string) || undefined,
      emergencyContactRelationship:
        (formData.get("emergencyContactRelationship") as string) || undefined,
    };

    const result = await updateMyProfile(data);

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">My Profile</h3>
        {!editing && (
          <button
            onClick={() => {
              setEditing(true);
              setSuccess(false);
            }}
            className="text-sm font-medium text-green-700 hover:text-green-800"
          >
            Edit
          </button>
        )}
      </div>

      {success && (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
          Profile updated successfully.
        </div>
      )}

      {!editing ? (
        <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd>
              {member.firstName} {member.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd>{member.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Date of Birth</dt>
            <dd>{member.dateOfBirth}</dd>
          </div>
          <div>
            <dt className="text-gray-500">DL State</dt>
            <dd>{member.driverLicenseState ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Veteran Discount</dt>
            <dd>{member.isVeteranDisabled ? "Yes" : "No"}</dd>
          </div>
          {(member.emergencyContactName ||
            member.emergencyContactPhone) && (
            <div>
              <dt className="text-gray-500">Emergency Contact</dt>
              <dd>
                {member.emergencyContactName}
                {member.emergencyContactPhone && (
                  <> &middot; {member.emergencyContactPhone}</>
                )}
                {member.emergencyContactRelationship && (
                  <> ({member.emergencyContactRelationship})</>
                )}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
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
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
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

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
