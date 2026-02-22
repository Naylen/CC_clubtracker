"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateMyHousehold } from "@/actions/member-portal";

interface EditHouseholdFormProps {
  household: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    zip: string;
    phone: string | null;
    email: string;
  };
}

export function EditHouseholdForm({ household }: EditHouseholdFormProps) {
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
      addressLine1: formData.get("addressLine1") as string,
      addressLine2: (formData.get("addressLine2") as string) || undefined,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      zip: formData.get("zip") as string,
      phone: (formData.get("phone") as string) || undefined,
    };

    const result = await updateMyHousehold(data);

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
        <h3 className="text-lg font-semibold text-gray-900">
          Household Details
        </h3>
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
          Household updated successfully.
        </div>
      )}

      {!editing ? (
        <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">Address</dt>
            <dd>
              {household.addressLine1}
              {household.addressLine2 && <>, {household.addressLine2}</>}
              <br />
              {household.city}, {household.state} {household.zip}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Contact</dt>
            <dd>
              {household.email}
              {household.phone && (
                <>
                  <br />
                  {household.phone}
                </>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">
              {household.name}
            </span>{" "}
            &middot; {household.email}
            <p className="mt-1 text-xs text-gray-400">
              Contact a club officer to change household name or email.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Address Line 1
            </label>
            <input
              name="addressLine1"
              defaultValue={household.addressLine1}
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Address Line 2
            </label>
            <input
              name="addressLine2"
              defaultValue={household.addressLine2 ?? ""}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                name="city"
                defaultValue={household.city}
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                State
              </label>
              <input
                name="state"
                defaultValue={household.state}
                required
                maxLength={2}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ZIP
              </label>
              <input
                name="zip"
                defaultValue={household.zip}
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              name="phone"
              defaultValue={household.phone ?? ""}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
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
