"use client";

import { useState } from "react";
import { setTempPassword } from "@/actions/admin";

interface SetTempPasswordFormProps {
  memberId: string;
  memberName: string;
}

export function SetTempPasswordForm({
  memberId,
  memberName,
}: SetTempPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await setTempPassword(memberId, password);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setPassword("");
      setConfirm("");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="rounded-md border bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-800">
        Set Temporary Password
      </h3>
      <p className="mt-1 text-xs text-amber-600">
        The member will be required to change this password on their next login.
      </p>

      {success && (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700">
          Temporary password set for {memberName}. They will be prompted to
          change it on next login.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Temporary Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Min 6 characters"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? "Setting..." : "Set Temp Password"}
        </button>
      </form>
    </div>
  );
}
