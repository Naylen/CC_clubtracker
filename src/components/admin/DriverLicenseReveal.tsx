"use client";

import { useState, useEffect, useCallback } from "react";
import { decryptDriverLicense } from "@/actions/encrypted-data";

interface DriverLicenseRevealProps {
  memberId: string;
}

export function DriverLicenseReveal({ memberId }: DriverLicenseRevealProps) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const hideValue = useCallback(() => {
    setRevealed(null);
    setCountdown(0);
  }, []);

  // Auto-hide after 30 seconds
  useEffect(() => {
    if (!revealed) return;

    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          hideValue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [revealed, hideValue]);

  async function handleReveal() {
    setError(null);
    setLoading(true);

    const result = await decryptDriverLicense(memberId);

    setLoading(false);

    if (result.success) {
      setRevealed(result.data.driverLicense);
    } else {
      setError(result.error);
    }
  }

  if (revealed) {
    return (
      <div className="flex items-center gap-3">
        <code className="rounded bg-gray-100 px-3 py-1.5 font-mono text-sm">
          {revealed}
        </code>
        <button
          onClick={hideValue}
          className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
        >
          Hide
        </button>
        <span className="text-xs text-gray-500">
          Auto-hides in {countdown}s
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleReveal}
        disabled={loading}
        className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "Decrypting..." : "Reveal DL Number"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
