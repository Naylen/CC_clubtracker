"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleMembershipTier } from "@/actions/membership-tiers";
import { useRouter } from "next/navigation";

interface Tier {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
}

interface MembershipTierTableProps {
  tiers: Tier[];
}

export function MembershipTierTable({ tiers }: MembershipTierTableProps) {
  const router = useRouter();
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleToggle(id: string) {
    setToggling(id);
    const result = await toggleMembershipTier(id);
    if (!result.success) {
      alert(result.error);
    }
    setToggling(null);
    router.refresh();
  }

  if (tiers.length === 0) {
    return (
      <div className="rounded-md border bg-gray-50 p-6 text-center text-sm text-gray-500">
        No membership tiers found. Create one to get started.
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`rounded-lg border bg-white p-4 ${!tier.isActive ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">{tier.name}</p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  tier.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {tier.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              ${(tier.priceCents / 100).toFixed(2)}
            </p>
            <div className="mt-2 flex gap-3">
              <Link
                href={`/admin/membership-tiers/${tier.id}`}
                className="text-sm text-green-700 hover:text-green-800 hover:underline"
              >
                Edit
              </Link>
              <button
                onClick={() => handleToggle(tier.id)}
                disabled={toggling === tier.id}
                className="text-sm text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-50"
              >
                {toggling === tier.id
                  ? "..."
                  : tier.isActive
                    ? "Deactivate"
                    : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 font-medium text-gray-700">
                Description
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">Price</th>
              <th className="px-4 py-3 font-medium text-gray-700">Order</th>
              <th className="px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tiers.map((tier) => (
              <tr key={tier.id} className={!tier.isActive ? "bg-gray-50" : ""}>
                <td className="px-4 py-3 font-medium">{tier.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {tier.description ?? "—"}
                </td>
                <td className="px-4 py-3">
                  ${(tier.priceCents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3">{tier.sortOrder}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      tier.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {tier.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/membership-tiers/${tier.id}`}
                      className="text-sm text-green-700 hover:text-green-800 hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleToggle(tier.id)}
                      disabled={toggling === tier.id}
                      className="text-sm text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-50"
                    >
                      {toggling === tier.id
                        ? "..."
                        : tier.isActive
                          ? "Deactivate"
                          : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
