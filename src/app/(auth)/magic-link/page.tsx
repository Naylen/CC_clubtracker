"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function MagicLinkPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authClient.signIn.magicLink({ email });
      setSent(true);
    } catch {
      setError("Failed to send magic link. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-green-800">MCFGC</h1>
          <p className="mt-1 text-sm text-gray-500">Member Portal</p>
        </div>

        {sent ? (
          <div className="mt-6 text-center">
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-700">
                Check your email! We sent a sign-in link to{" "}
                <strong>{email}</strong>.
              </p>
              <p className="mt-2 text-xs text-green-600">
                The link expires in 10 minutes.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the email address associated with your MCFGC membership.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Sign-In Link"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Montgomery County Fish & Game Club
        </p>
      </div>
    </div>
  );
}
