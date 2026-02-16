"use client";

interface VeteranDocViewerProps {
  memberId: string;
  filename: string | null;
}

export function VeteranDocViewer({
  memberId,
  filename,
}: VeteranDocViewerProps) {
  if (!filename) {
    return (
      <span className="text-sm text-gray-500">No veteran document on file</span>
    );
  }

  function handleView() {
    // Open the admin API route in a new tab — it verifies admin session server-side
    window.open(`/api/admin/veteran-doc/${memberId}`, "_blank");
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleView}
        className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
      >
        View Veteran Document
      </button>
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
        {filename}
      </span>
    </div>
  );
}
