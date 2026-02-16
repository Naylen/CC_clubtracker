"use client";

import { useState } from "react";
import { createStripeCheckout } from "@/actions/payments";
import { formatCurrency } from "@/lib/utils/dates";

interface RenewalCardProps {
  membershipId: string;
  status: string;
  priceCents: number;
  discountType: string;
  year: number;
  renewalWindowOpen: boolean;
  renewalOpensAt: string;
  renewalDeadline: string;
}

export function RenewalCard({
  membershipId,
  status,
  priceCents,
  discountType,
  year,
  renewalWindowOpen,
  renewalOpensAt,
  renewalDeadline,
}: RenewalCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opensDate = new Date(renewalOpensAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const deadlineDate = new Date(renewalDeadline).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  async function handlePayOnline() {
    setLoading(true);
    setError(null);

    const result = await createStripeCheckout(membershipId);

    if (result.success) {
      window.location.href = result.data.url;
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  if (status === "ACTIVE") {
    return (
      <div className="rounded-lg border bg-green-50 p-6">
        <h3 className="text-lg font-semibold text-green-800">
          {year} Membership — Active
        </h3>
        <p className="mt-1 text-sm text-green-600">
          Your membership is active. Thank you for being a member of MCFGC!
        </p>
      </div>
    );
  }

  if (status === "LAPSED") {
    return (
      <div className="rounded-lg border bg-red-50 p-6">
        <h3 className="text-lg font-semibold text-red-800">
          {year} Membership — Lapsed
        </h3>
        <p className="mt-1 text-sm text-red-600">
          Your membership has lapsed. Please contact a club officer about
          re-enrollment at the next sign-up day.
        </p>
      </div>
    );
  }

  // Renewal window is closed - show message instead of pay button
  if (!renewalWindowOpen) {
    const now = new Date();
    const opens = new Date(renewalOpensAt);
    const isBeforeWindow = now < opens;

    return (
      <div className="rounded-lg border bg-gray-50 p-6">
        <h3 className="text-lg font-semibold text-gray-800">
          {year} Membership — Renewal Due
        </h3>
        <div className="mt-3 space-y-2">
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(priceCents)}
          </p>
          {discountType !== "NONE" && (
            <p className="text-sm text-green-700">
              {discountType === "VETERAN"
                ? "Disabled Veteran Discount"
                : "Senior Discount (65+)"}{" "}
              applied
            </p>
          )}
          <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm font-medium text-yellow-800">
              {isBeforeWindow
                ? `The renewal window has not opened yet. Renewals open on ${opensDate}.`
                : `The renewal window has closed. The deadline was ${deadlineDate}. Please contact a club officer.`}
            </p>
            <p className="mt-2 text-xs text-yellow-700">
              Renewal window: {opensDate} &ndash; {deadlineDate}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-yellow-50 p-6">
      <h3 className="text-lg font-semibold text-yellow-800">
        {year} Membership — Renewal Due
      </h3>
      <div className="mt-3 space-y-2">
        <p className="text-2xl font-bold text-gray-900">
          {formatCurrency(priceCents)}
        </p>
        {discountType !== "NONE" && (
          <p className="text-sm text-green-700">
            {discountType === "VETERAN"
              ? "Disabled Veteran Discount"
              : "Senior Discount (65+)"}{" "}
            applied
          </p>
        )}
        <p className="text-sm text-gray-600">
          Renewal window: {opensDate} &ndash; {deadlineDate}
        </p>
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handlePayOnline}
        disabled={loading}
        className="mt-4 rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {loading ? "Redirecting to checkout..." : "Pay Online"}
      </button>
    </div>
  );
}
