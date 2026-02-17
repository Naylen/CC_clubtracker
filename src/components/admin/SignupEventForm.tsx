"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { upsertSignupEvent } from "@/actions/signup-events";

interface SignupEventFormProps {
  membershipYearId: string;
  existing?: {
    eventDate: string;
    eventStartTime: string;
    eventEndTime: string;
    location: string;
    notes: string | null;
  } | null;
}

/** Normalize "HH:MM:SS" → "HH:MM" for <input type="time"> */
function toHHMM(time: string): string {
  return time.slice(0, 5);
}

export function SignupEventForm({
  membershipYearId,
  existing,
}: SignupEventFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(!!existing);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      membershipYearId,
      eventDate: formData.get("eventDate") as string,
      eventStartTime: formData.get("eventStartTime") as string,
      eventEndTime: formData.get("eventEndTime") as string,
      location: (formData.get("location") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    const result = await upsertSignupEvent(data);

    setLoading(false);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="rounded-md border border-green-700 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
      >
        + Configure Sign-Up Day Event
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-gray-50 p-4 space-y-4"
    >
      <h4 className="text-sm font-semibold text-gray-900">
        {existing ? "Update Sign-Up Day Event" : "Configure Sign-Up Day Event"}
      </h4>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Event Date
        </label>
        <input
          name="eventDate"
          type="date"
          defaultValue={existing?.eventDate ?? ""}
          required
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Start Time
          </label>
          <input
            name="eventStartTime"
            type="time"
            defaultValue={existing ? toHHMM(existing.eventStartTime) : "08:00"}
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            End Time
          </label>
          <input
            name="eventEndTime"
            type="time"
            defaultValue={existing ? toHHMM(existing.eventEndTime) : "12:00"}
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Location
        </label>
        <input
          name="location"
          defaultValue={
            existing?.location ??
            "6701 Old Nest Egg Rd, Mt Sterling, KY 40353"
          }
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Notes (optional)
        </label>
        <textarea
          name="notes"
          defaultValue={existing?.notes ?? ""}
          rows={2}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? "Saving..." : existing ? "Update Event" : "Create Event"}
        </button>
        {!existing && (
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
