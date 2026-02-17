"use client";

import { useState, useRef } from "react";
import { importMembers, getImportTemplate } from "@/actions/import";
import type { ImportResult } from "@/actions/import";
import { Upload, Download, FileText, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface MembershipYearOption {
  id: string;
  year: number;
  capacityCap: number;
}

export function ImportMembersForm({
  membershipYears,
}: {
  membershipYears: MembershipYearOption[];
}) {
  const [selectedYearId, setSelectedYearId] = useState(
    membershipYears[0]?.id ?? ""
  );
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedYear = membershipYears.find((y) => y.id === selectedYearId);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setFileName(file.name);

    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      setCsvText("");
      return;
    }

    // 5MB max
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum 5MB.");
      setCsvText("");
      return;
    }

    const text = await file.text();
    setCsvText(text);
  }

  async function handleSubmit() {
    if (!csvText) {
      setError("Please upload a CSV file first");
      return;
    }
    if (!selectedYearId) {
      setError("Please select a membership year");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await importMembers(csvText, selectedYearId);
      if (res.success) {
        setResult(res.data);
        // Clear the file input on success
        if (res.data.errors.length === 0) {
          setCsvText("");
          setFileName(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const template = await getImportTemplate();
      const blob = new Blob([template], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "member-import-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download template");
    }
  }

  // Preview: parse CSV headers and count rows
  const previewInfo = csvText
    ? (() => {
        const lines = csvText
          .split(/\r?\n/)
          .filter((l) => l.trim().length > 0);
        return {
          headers: lines[0]?.split(",").map((h) => h.trim()) ?? [],
          rowCount: Math.max(0, lines.length - 1),
        };
      })()
    : null;

  return (
    <div className="space-y-6">
      {/* Membership Year Selector */}
      <div>
        <label
          htmlFor="membershipYear"
          className="block text-sm font-medium text-gray-700"
        >
          Target Membership Year
        </label>
        <select
          id="membershipYear"
          value={selectedYearId}
          onChange={(e) => {
            setSelectedYearId(e.target.value);
            setResult(null);
            setError(null);
          }}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          {membershipYears.length === 0 && (
            <option value="">No membership years available</option>
          )}
          {membershipYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.year} (cap: {y.capacityCap})
            </option>
          ))}
        </select>
      </div>

      {/* CSV Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          CSV File
        </label>
        <div className="mt-1 flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            {fileName ? "Change File" : "Choose File"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {fileName && (
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <FileText className="h-4 w-4" />
              {fileName}
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      {previewInfo && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-sm font-medium text-blue-800">CSV Preview</h4>
          <p className="mt-1 text-sm text-blue-700">
            <strong>{previewInfo.rowCount}</strong> data row
            {previewInfo.rowCount !== 1 ? "s" : ""} detected
          </p>
          <p className="mt-1 text-sm text-blue-600">
            Columns: {previewInfo.headers.join(", ")}
          </p>
        </div>
      )}

      {/* Download Template */}
      <div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-900 hover:underline"
        >
          <Download className="h-4 w-4" />
          Download CSV Template
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Result Summary */}
      {result && (
        <div className="space-y-3">
          <div
            className={`flex items-start gap-2 rounded-md border p-4 ${
              result.errors.length === 0
                ? "border-green-200 bg-green-50"
                : "border-yellow-200 bg-yellow-50"
            }`}
          >
            {result.errors.length === 0 ? (
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
            )}
            <div className="text-sm">
              <p className="font-medium text-gray-900">Import Complete</p>
              <ul className="mt-1 space-y-0.5 text-gray-700">
                <li>
                  <strong>{result.imported}</strong> member
                  {result.imported !== 1 ? "s" : ""} imported successfully
                </li>
                {result.skipped > 0 && (
                  <li>
                    <strong>{result.skipped}</strong> skipped (already exist)
                  </li>
                )}
                {result.errors.length > 0 && (
                  <li>
                    <strong>{result.errors.length}</strong> row
                    {result.errors.length !== 1 ? "s" : ""} with errors
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Error Details */}
          {result.errors.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowErrors(!showErrors)}
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {showErrors ? "Hide" : "Show"} error details (
                {result.errors.length})
              </button>
              {showErrors && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 border-b bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 font-medium text-gray-500">
                          Row
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-500">
                          Field
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-500">
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-gray-600">
                            {err.row}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {err.field ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-red-700">
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !csvText || !selectedYearId}
          className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Import Members
            </>
          )}
        </button>
        {selectedYear && csvText && !loading && (
          <p className="text-sm text-gray-500">
            {previewInfo?.rowCount ?? 0} rows will be imported into{" "}
            <strong>{selectedYear.year}</strong>
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <h4 className="text-sm font-medium text-gray-800">Import Notes</h4>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">
          <li>
            &bull; Members are imported with <strong>ACTIVE</strong> status
            (already paid)
          </li>
          <li>
            &bull; Households with the same email are reused (not duplicated)
          </li>
          <li>
            &bull; Rows with duplicate memberships for the selected year are
            skipped
          </li>
          <li>
            &bull; Veteran/senior discounts are calculated automatically from
            DOB and veteran status
          </li>
          <li>
            &bull; Required columns: firstName, lastName, email, dateOfBirth,
            addressLine1, city, state, zip
          </li>
          <li>
            &bull; Optional columns: isVeteranDisabled, addressLine2, phone
          </li>
          <li>
            &bull; Date of birth format: YYYY-MM-DD
          </li>
        </ul>
      </div>
    </div>
  );
}
