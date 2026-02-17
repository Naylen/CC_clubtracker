"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendBroadcast, getRecipientCount } from "@/actions/broadcasts";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import type { RecipientFilter, MembershipStatus } from "@/types";
import type { EmailProvider } from "@/lib/email";

interface Provider {
  provider: EmailProvider;
  label: string;
}

interface BroadcastFormProps {
  providers: Provider[];
}

export function BroadcastForm({ providers }: BroadcastFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [filter, setFilter] = useState<RecipientFilter>({});
  const [bodyHtml, setBodyHtml] = useState("");
  const [emailProvider, setEmailProvider] = useState<EmailProvider>(
    providers[0]?.provider ?? "resend"
  );

  async function handlePreview() {
    const count = await getRecipientCount(filter);
    setRecipientCount(count);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const strippedBody = bodyHtml.replace(/<[^>]*>/g, "").trim();
    if (!strippedBody) {
      setError("Email body cannot be empty.");
      setLoading(false);
      return;
    }

    const result = await sendBroadcast({
      subject: formData.get("subject") as string,
      body: bodyHtml,
      recipientFilter: filter,
      emailProvider,
    });

    setLoading(false);

    if (result.success) {
      window.location.href = "/admin/broadcasts";
      return;
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Recipient Filter
          </label>
          <select
            value={filter.status ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setFilter(
                val
                  ? { ...filter, status: val as MembershipStatus }
                  : { ...filter, status: undefined }
              );
              setRecipientCount(null);
            }}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All Members</option>
            <option value="ACTIVE">Active Only</option>
            <option value="PENDING_RENEWAL">Pending Renewal</option>
            <option value="LAPSED">Lapsed Only</option>
          </select>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handlePreview}
              className="text-sm text-green-700 hover:text-green-900"
            >
              Preview recipient count
            </button>
            {recipientCount !== null && (
              <span className="text-sm text-gray-600">
                {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Send Via
          </label>
          {providers.length > 0 ? (
            <select
              value={emailProvider}
              onChange={(e) =>
                setEmailProvider(e.target.value as EmailProvider)
              }
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {providers.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 text-sm text-red-600">
              No email providers configured. Set RESEND_API_KEY or
              GMAIL_USER/GMAIL_APP_PASSWORD in your environment.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {emailProvider === "gmail"
              ? "Gmail: ~500 emails/day (personal) or ~2,000/day (Workspace)"
              : "Resend: batch API, higher throughput"}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Subject
        </label>
        <input
          name="subject"
          required
          maxLength={200}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Body</label>
        <div className="mt-1">
          <RichTextEditor onChange={setBodyHtml} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || providers.length === 0}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Broadcast"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
