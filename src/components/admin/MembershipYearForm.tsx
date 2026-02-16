"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createMembershipYear,
  updateMembershipYear,
} from "@/actions/membership-years";

interface MembershipYearFormProps {
  membershipYear?: {
    id: string;
    year: number;
    opensAt: Date;
    renewalDeadline: Date;
    capacityCap: number;
  };
}

export function MembershipYearForm({
  membershipYear,
}: MembershipYearFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = !!membershipYear;

  const nextYear = new Date().getFullYear() + 1;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const year = parseInt(formData.get("year") as string);

    const data = {
      year,
      opensAt: new Date(
        formData.get("opensAt") as string
      ).toISOString(),
      renewalDeadline: new Date(
        formData.get("renewalDeadline") as string
      ).toISOString(),
      capacityCap: parseInt(formData.get("capacityCap") as string),
    };

    const result = isEdit
      ? await updateMembershipYear(membershipYear.id, data)
      : await createMembershipYear(data);

    setLoading(false);

    if (result.success) {
      router.push("/admin/membership-years");
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
        <label className="block text-sm font-medium text-gray-700">Year</label>
        <input
          name="year"
          type="number"
          defaultValue={membershipYear?.year ?? nextYear}
          required
          min={2020}
          max={2100}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Renewals Open
        </label>
        <input
          name="opensAt"
          type="datetime-local"
          defaultValue={
            membershipYear?.opensAt
              ? new Date(membershipYear.opensAt).toISOString().slice(0, 16)
              : `${nextYear}-01-01T00:00`
          }
          required
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Renewal Deadline
        </label>
        <input
          name="renewalDeadline"
          type="datetime-local"
          defaultValue={
            membershipYear?.renewalDeadline
              ? new Date(membershipYear.renewalDeadline)
                  .toISOString()
                  .slice(0, 16)
              : `${nextYear}-01-31T23:59`
          }
          required
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Capacity Cap
        </label>
        <input
          name="capacityCap"
          type="number"
          defaultValue={membershipYear?.capacityCap ?? 350}
          required
          min={1}
          max={10000}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Maximum number of household memberships for this year.
        </p>
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
              ? "Update Year"
              : "Create Year"}
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
