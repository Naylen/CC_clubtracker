"use client";

import { useState } from "react";
import Link from "next/link";

interface MemberWithHousehold {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string;
  householdId: string;
  householdName: string;
  householdEmail: string;
  city: string;
  state: string;
}

interface MemberTableProps {
  members: MemberWithHousehold[];
}

export function MemberTable({ members }: MemberTableProps) {
  const [search, setSearch] = useState("");

  const filtered = members.filter(
    (m) =>
      `${m.firstName} ${m.lastName}`
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (m.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      m.householdName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or household..."
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
              <th className="px-4 py-3 font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 font-medium text-gray-500">Household</th>
              <th className="px-4 py-3 font-medium text-gray-500">Location</th>
              <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  {m.firstName} {m.lastName}
                </td>
                <td className="px-4 py-3 text-gray-600">{m.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      m.role === "PRIMARY"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{m.householdName}</td>
                <td className="px-4 py-3 text-gray-600">
                  {m.city}, {m.state}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/members/${m.id}`}
                    className="text-green-700 hover:text-green-900"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {search
                    ? "No members match your search."
                    : "No members yet. Add one to get started."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        {filtered.length} member{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
