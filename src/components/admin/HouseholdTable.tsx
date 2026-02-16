"use client";

import { useState } from "react";
import Link from "next/link";

interface Household {
  id: string;
  name: string;
  email: string;
  city: string;
  state: string;
  phone: string | null;
}

interface HouseholdTableProps {
  households: Household[];
}

export function HouseholdTable({ households }: HouseholdTableProps) {
  const [search, setSearch] = useState("");

  const filtered = households.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 font-medium text-gray-500">Location</th>
              <th className="px-4 py-3 font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((h) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{h.name}</td>
                <td className="px-4 py-3 text-gray-600">{h.email}</td>
                <td className="px-4 py-3 text-gray-600">
                  {h.city}, {h.state}
                </td>
                <td className="px-4 py-3 text-gray-600">{h.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/households/${h.id}`}
                    className="text-green-700 hover:text-green-900"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {search
                    ? "No households match your search."
                    : "No households yet. Create one to get started."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        {filtered.length} household{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
