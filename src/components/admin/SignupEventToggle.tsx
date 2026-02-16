"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleSignupEventVisibility } from "@/actions/signup-events";

interface SignupEventToggleProps {
  signupEventId: string;
  isPublic: boolean;
}

export function SignupEventToggle({
  signupEventId,
  isPublic,
}: SignupEventToggleProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    await toggleSignupEventVisibility(signupEventId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
          isPublic ? "bg-green-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isPublic ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="text-sm text-gray-700">
        {loading
          ? "Updating..."
          : isPublic
            ? "Visible to members"
            : "Hidden from members"}
      </span>
    </div>
  );
}
