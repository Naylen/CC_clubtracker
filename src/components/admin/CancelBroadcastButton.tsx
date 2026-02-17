"use client";

import { useState } from "react";
import { cancelScheduledBroadcast } from "@/actions/broadcasts";
import { useRouter } from "next/navigation";

interface CancelBroadcastButtonProps {
  broadcastId: string;
}

export function CancelBroadcastButton({
  broadcastId,
}: CancelBroadcastButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this scheduled broadcast?")) {
      return;
    }

    setLoading(true);
    const result = await cancelScheduledBroadcast(broadcastId);
    setLoading(false);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {loading ? "Cancelling..." : "Cancel"}
    </button>
  );
}
