"use client";

import { useState } from "react";
import { createStripeCheckout } from "@/actions/payments";
import { formatCurrency } from "@/lib/utils/dates";

interface ApplicationStatusCardProps {
  membershipId: string;
  status: string;
  priceCents: number;
  discountType: string;
  membershipTierId: string | null;
  tierName: string | null;
}

export function ApplicationStatusCard({
  membershipId,
  status,
  priceCents,
  discountType,
  membershipTierId,
  tierName,
}: ApplicationStatusCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePayWithCard() {
    setError(null);
    setLoading(true);

    const result = await createStripeCheckout(membershipId);

    if (result.success) {
      window.location.href = result.data.url;
    } else {
      setLoading(false);
      setError(result.error);
    }
  }

  // Active membership
  if (status === "ACTIVE") {
    return (
      <div className="rounded-lg border-2 border-green-300 bg-green-50 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-200">
            <svg
              className="h-6 w-6 text-green-700"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-900">
              Active Member
            </h3>
            <p className="text-sm text-green-700">
              Your membership is active. Welcome to the club!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Approved — awaiting payment (NEW_PENDING with tier assigned)
  if (status === "NEW_PENDING" && membershipTierId) {
    return (
      <div className="rounded-lg border-2 border-green-300 bg-green-50 p-6">
        <h3 className="text-lg font-semibold text-green-900">
          Application Approved
        </h3>
        <p className="mt-1 text-sm text-green-700">
          Your application has been approved! Complete payment to activate your
          membership.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="rounded-md bg-white px-4 py-2 shadow-sm">
            <p className="text-xs text-gray-500">
              {tierName ?? "Membership"} Tier
            </p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(priceCents)}
            </p>
            {discountType !== "NONE" && (
              <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {discountType} discount applied
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handlePayWithCard}
          disabled={loading}
          className="mt-4 rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? "Redirecting to payment..." : "Pay with Card"}
        </button>
      </div>
    );
  }

  // Pending review (NEW_PENDING with no tier)
  if (status === "NEW_PENDING" && !membershipTierId) {
    return (
      <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-200">
            <svg
              className="h-6 w-6 text-yellow-700"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-900">
              Application Under Review
            </h3>
            <p className="text-sm text-yellow-700">
              Your application is being reviewed by a club officer. You will be
              notified once a decision is made.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Removed membership
  if (status === "REMOVED") {
    return (
      <div className="rounded-lg border-2 border-gray-300 bg-gray-50 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
            <svg
              className="h-6 w-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Membership Removed
            </h3>
            <p className="text-sm text-gray-600">
              Please contact a club officer if you have questions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Other statuses (LAPSED, etc.) — don't render
  return null;
}
