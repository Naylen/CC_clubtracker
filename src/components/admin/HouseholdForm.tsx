"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createHousehold, updateHousehold } from "@/actions/households";
import type { HouseholdInput } from "@/lib/validators/household";

interface HouseholdFormProps {
  household?: {
    id: string;
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

export function HouseholdForm({ household }: HouseholdFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = !!household;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data: HouseholdInput = {
      name: formData.get("name") as string,
      addressLine1: formData.get("addressLine1") as string,
      addressLine2: (formData.get("addressLine2") as string) || undefined,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      zip: formData.get("zip") as string,
      phone: (formData.get("phone") as string) || undefined,
      email: formData.get("email") as string,
    };

    const result = isEdit
      ? await updateHousehold(household.id, data)
      : await createHousehold(data);

    setLoading(false);

    if (result.success) {
      router.push("/admin/households");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Household Name
        </label>
        <input
          name="name"
          defaultValue={household?.name}
          required
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          name="email"
          type="email"
          defaultValue={household?.email}
          required
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Address Line 1
        </label>
        <input
          name="addressLine1"
          defaultValue={household?.addressLine1}
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
          defaultValue={household?.addressLine2 ?? ""}
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
            defaultValue={household?.city ?? "Mt Sterling"}
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
            defaultValue={household?.state ?? "KY"}
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
            defaultValue={household?.zip ?? "40353"}
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
          defaultValue={household?.phone ?? ""}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading
            ? "Saving..."
            : isEdit
              ? "Update Household"
              : "Create Household"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
