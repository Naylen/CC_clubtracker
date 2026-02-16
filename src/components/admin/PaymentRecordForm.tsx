"use client";

import { useState } from "react";
import { recordPayment } from "@/actions/payments";
import { formatCurrency } from "@/lib/utils/dates";

interface PaymentRecordFormProps {
  membershipId: string;
  priceCents: number;
  householdName: string;
  onSuccess?: () => void;
}

export function PaymentRecordForm({
  membershipId,
  priceCents,
  householdName,
  onSuccess,
}: PaymentRecordFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const method = formData.get("method") as "CASH" | "CHECK";

    const result = await recordPayment({
      membershipId,
      amountCents: priceCents,
      method,
    });

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      onSuccess?.();
    } else {
      setError(result.error);
    }
  }

  if (success) {
    return (
      <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
        Payment recorded successfully for {householdName}.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <p className="text-sm text-gray-600">
          Record payment for <strong>{householdName}</strong>
        </p>
        <p className="text-lg font-bold text-gray-900">
          {formatCurrency(priceCents)}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Payment Method
        </label>
        <select
          name="method"
          required
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="CASH">Cash</option>
          <option value="CHECK">Check</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {loading ? "Recording..." : "Record Payment"}
      </button>
    </form>
  );
}
