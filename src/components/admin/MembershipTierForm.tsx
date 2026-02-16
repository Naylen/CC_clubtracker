"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createMembershipTier,
  updateMembershipTier,
} from "@/actions/membership-tiers";

interface TierFormData {
  id?: string;
  name: string;
  description: string;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
}

interface MembershipTierFormProps {
  initialData?: TierFormData;
  mode: "create" | "edit";
}

export function MembershipTierForm({
  initialData,
  mode,
}: MembershipTierFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [priceDollars, setPriceDollars] = useState(
    initialData ? (initialData.priceCents / 100).toFixed(2) : ""
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const priceCents = Math.round(parseFloat(priceDollars) * 100);

    if (isNaN(priceCents) || priceCents < 0) {
      setError("Please enter a valid price.");
      setLoading(false);
      return;
    }

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      priceCents,
      isActive,
      sortOrder,
    };

    const result =
      mode === "create"
        ? await createMembershipTier(data)
        : await updateMembershipTier(initialData!.id!, data);

    if (result.success) {
      router.push("/admin/membership-tiers");
      router.refresh();
    } else {
      setError(result.error);
      setLoading(false);
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
          Tier Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Standard, Senior, Disabled Veteran"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional description of this tier"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Price ($) *
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={priceDollars}
          onChange={(e) => setPriceDollars(e.target.value)}
          required
          placeholder="150.00"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Sort Order
        </label>
        <input
          type="number"
          min="0"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Lower numbers appear first in lists.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="isActive" className="text-sm text-gray-700">
          Active (available for selection)
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading
            ? "Saving..."
            : mode === "create"
              ? "Create Tier"
              : "Update Tier"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/membership-tiers")}
          className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
