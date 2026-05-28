"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  sendBroadcast,
  getRecipientCount,
  previewBroadcast,
} from "@/actions/broadcasts";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Paperclip, X } from "lucide-react";
import type { RecipientFilter, MembershipStatus } from "@/types";
import type { EmailProvider } from "@/lib/email";

interface AttachmentItem {
  id: string;
  filename: string;
  sizeBytes: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface Provider {
  provider: EmailProvider;
  label: string;
}

interface BroadcastFormProps {
  providers: Provider[];
}

/**
 * Convert a datetime-local string (entered as Eastern Time) to a UTC Date.
 */
function easternToUtc(datetimeLocal: string): Date {
  // Create a date string that explicitly specifies America/New_York
  // datetime-local gives us "YYYY-MM-DDTHH:mm"
  const eastern = new Date(
    new Date(datetimeLocal).toLocaleString("en-US", {
      timeZone: "America/New_York",
    })
  );
  // This approach can be unreliable; instead use the Intl API to find offset
  const utcMs = new Date(datetimeLocal + ":00").getTime();
  // Get the offset by computing what time it is in ET for a known UTC time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  // Parse the ET representation of our input as if it were UTC to find the offset
  const parts = formatter.formatToParts(new Date(utcMs));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  const etNow = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
  );
  const offsetMs = etNow.getTime() - utcMs;
  // The user entered a time in ET, so subtract the offset to get UTC
  return new Date(utcMs - offsetMs);
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
  const [sendMode, setSendMode] = useState<"now" | "scheduled">("now");
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  // Generated once per form mount; attachments uploaded against it get
  // re-linked to the broadcast row on send/schedule.
  const [draftId] = useState(() => crypto.randomUUID());
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function uploadAttachment(file: File) {
    setAttachmentError(null);
    setAttachmentUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("draftId", draftId);
      fd.append("isInline", "false");
      const res = await fetch("/api/admin/broadcast-attachments", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as AttachmentItem;
      setAttachments((prev) => [...prev, data]);
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Upload failed",
      );
    } finally {
      setAttachmentUploading(false);
    }
  }

  async function removeAttachment(id: string) {
    setAttachmentError(null);
    try {
      const res = await fetch(`/api/admin/broadcast-attachments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Delete failed (${res.status})`);
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Delete failed",
      );
    }
  }

  async function openPreview() {
    setPreviewError(null);
    setPreviewHtml(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const { html } = await previewBroadcast(bodyHtml);
      setPreviewHtml(html);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Failed to render preview",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

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

    // Validate scheduled time is in the future
    let scheduledFor: Date | undefined;
    if (sendMode === "scheduled") {
      if (!scheduledDateTime) {
        setError("Please select a date and time for the scheduled broadcast.");
        setLoading(false);
        return;
      }
      scheduledFor = easternToUtc(scheduledDateTime);
      if (scheduledFor.getTime() <= Date.now()) {
        setError("Scheduled time must be in the future.");
        setLoading(false);
        return;
      }
    }

    const result = await sendBroadcast({
      subject: formData.get("subject") as string,
      body: bodyHtml,
      recipientFilter: filter,
      emailProvider,
      draftId,
      ...(scheduledFor ? { scheduledFor: scheduledFor.toISOString() } : {}),
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <RichTextEditor onChange={setBodyHtml} draftId={draftId} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Attachments
          </label>
          <input
            ref={attachmentInputRef}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAttachment(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => attachmentInputRef.current?.click()}
            disabled={attachmentUploading}
            className="flex items-center gap-1.5 text-sm text-green-700 hover:text-green-900 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
            {attachmentUploading ? "Uploading…" : "Attach a file"}
          </button>
        </div>
        {attachmentError && (
          <p className="mt-1 text-xs text-red-600">{attachmentError}</p>
        )}
        {attachments.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-200 rounded-md border">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="truncate">{a.filename}</span>
                <span className="shrink-0 text-xs text-gray-500">
                  {formatBytes(a.sizeBytes)}
                </span>
                <button
                  type="button"
                  onClick={() => void removeAttachment(a.id)}
                  className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Send Mode Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Delivery
        </label>
        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sendMode"
              value="now"
              checked={sendMode === "now"}
              onChange={() => setSendMode("now")}
              className="text-green-700 focus:ring-green-700"
            />
            Send Now
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sendMode"
              value="scheduled"
              checked={sendMode === "scheduled"}
              onChange={() => setSendMode("scheduled")}
              className="text-green-700 focus:ring-green-700"
            />
            Schedule for Later
          </label>
        </div>
        {sendMode === "scheduled" && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700">
              Send At (Eastern Time)
            </label>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="mt-1 rounded-md border px-3 py-2 text-sm"
              required={sendMode === "scheduled"}
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || providers.length === 0}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading
            ? sendMode === "scheduled"
              ? "Scheduling..."
              : "Sending..."
            : sendMode === "scheduled"
              ? "Schedule Broadcast"
              : "Send Broadcast"}
        </button>
        <button
          type="button"
          onClick={() => void openPreview()}
          disabled={!bodyHtml.trim()}
          className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Preview
                </p>
                <p className="mt-0.5 font-medium text-gray-900">
                  {/* The current subject input value lives in the form;
                      pull it from the form directly to keep this self-contained. */}
                  {(typeof document !== "undefined" &&
                    (document.querySelector(
                      'input[name="subject"]',
                    ) as HTMLInputElement | null)?.value) ||
                    "(no subject)"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Recipients see this exactly, minus in-app image URLs (those
                  get swapped for cid: refs at send time).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewLoading && (
                <p className="text-sm text-gray-600">Rendering…</p>
              )}
              {previewError && (
                <p className="rounded bg-red-50 p-3 text-sm text-red-700">
                  {previewError}
                </p>
              )}
              {previewHtml && (
                <iframe
                  title="Broadcast preview"
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                  className="h-[55vh] w-full rounded border bg-white"
                />
              )}
              {attachments.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700">
                    Attachments ({attachments.length})
                  </p>
                  <ul className="mt-1 text-sm text-gray-700">
                    {attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex justify-between gap-2 py-0.5"
                      >
                        <span className="truncate">{a.filename}</span>
                        <span className="text-xs text-gray-500">
                          {formatBytes(a.sizeBytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
