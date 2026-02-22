"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeMyDependent } from "@/actions/member-portal";

interface RemoveDependentButtonProps {
  dependentId: string;
  dependentName: string;
}

export function RemoveDependentButton({
  dependentId,
  dependentName,
}: RemoveDependentButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (
      !window.confirm(
        `Are you sure you want to remove ${dependentName} from your household?`
      )
    ) {
      return;
    }

    setError(null);
    setLoading(true);

    const result = await removeMyDependent(dependentId);

    setLoading(false);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <button
        onClick={handleRemove}
        disabled={loading}
        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {loading ? "Removing..." : "Remove"}
      </button>
      {error && (
        <span className="ml-2 text-xs text-red-600">{error}</span>
      )}
    </>
  );
}
