"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateMyDependent } from "@/actions/member-portal";

interface MemberEditDependentFormProps {
  dependent: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    email: string | null;
  };
}

export function MemberEditDependentForm({
  dependent,
}: MemberEditDependentFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      dateOfBirth: formData.get("dateOfBirth") as string,
      email: (formData.get("email") as string) || undefined,
    };

    const result = await updateMyDependent(dependent.id, data);

    setLoading(false);

    if (result.success) {
      setEditing(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs font-medium text-green-700 hover:text-green-800"
      >
        Edit
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 rounded-lg border bg-gray-50 p-4 space-y-4"
    >
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            First Name
          </label>
          <input
            name="firstName"
            defaultValue={dependent.firstName}
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Last Name
          </label>
          <input
            name="lastName"
            defaultValue={dependent.lastName}
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Email (optional)
        </label>
        <input
          name="email"
          type="email"
          defaultValue={dependent.email ?? ""}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Date of Birth
        </label>
        <input
          name="dateOfBirth"
          type="date"
          defaultValue={dependent.dateOfBirth}
          required
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
