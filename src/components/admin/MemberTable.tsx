"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatMembershipNumber } from "@/lib/utils/format-membership-number";

interface MemberWithHousehold {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: string;
  membershipNumber: number | null;
  householdId: string;
  householdName: string;
  householdEmail: string;
  city: string;
  state: string;
  membershipStatus: string | null;
}

type SortKey =
  | "membershipNumber"
  | "lastName"
  | "email"
  | "role"
  | "membershipStatus"
  | "householdName"
  | "location";

interface MemberTableProps {
  members: MemberWithHousehold[];
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400">—</span>;

  const styles: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    LAPSED: "bg-red-100 text-red-700",
    REMOVED: "bg-gray-200 text-gray-700",
    NEW_PENDING: "bg-yellow-100 text-yellow-700",
    PENDING_RENEWAL: "bg-yellow-100 text-yellow-700",
  };

  const labels: Record<string, string> = {
    ACTIVE: "Active",
    LAPSED: "Lapsed",
    REMOVED: "Removed",
    NEW_PENDING: "New Pending",
    PENDING_RENEWAL: "Pending Renewal",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) {
    return (
      <svg className="ml-1 inline h-3 w-3 text-gray-400" viewBox="0 0 10 14" fill="currentColor">
        <path d="M5 0L9 5H1L5 0Z" opacity="0.4" />
        <path d="M5 14L1 9H9L5 14Z" opacity="0.4" />
      </svg>
    );
  }
  return (
    <span className="ml-1 text-xs text-gray-700">
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

function compareStrings(a: string | null, b: string | null, dir: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export function MemberTable({ members }: MemberTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return members.filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(lowerSearch) ||
        (m.email ?? "").toLowerCase().includes(lowerSearch) ||
        m.householdName.toLowerCase().includes(lowerSearch) ||
        (m.membershipNumber != null &&
          String(m.membershipNumber).includes(search)),
    );
  }, [members, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "membershipNumber": {
          if (a.membershipNumber === null && b.membershipNumber === null) return 0;
          if (a.membershipNumber === null) return 1;
          if (b.membershipNumber === null) return -1;
          const diff = a.membershipNumber - b.membershipNumber;
          return sortDir === "asc" ? diff : -diff;
        }
        case "lastName": {
          const cmp = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
          if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
          const cmpFirst = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
          return sortDir === "asc" ? cmpFirst : -cmpFirst;
        }
        case "email":
          return compareStrings(a.email, b.email, sortDir);
        case "role":
          return compareStrings(a.role, b.role, sortDir);
        case "membershipStatus":
          return compareStrings(a.membershipStatus, b.membershipStatus, sortDir);
        case "householdName":
          return compareStrings(a.householdName, b.householdName, sortDir);
        case "location": {
          const cmp = a.city.localeCompare(b.city, undefined, { sensitivity: "base" });
          if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
          const cmpState = a.state.localeCompare(b.state, undefined, { sensitivity: "base" });
          return sortDir === "asc" ? cmpState : -cmpState;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const headerClass =
    "px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700";

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or household..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm md:max-w-sm"
        />
      </div>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {sorted.map((m) => (
          <div key={m.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {m.firstName} {m.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  {m.membershipNumber != null
                    ? `#${formatMembershipNumber(m.membershipNumber)}`
                    : "No #"}
                  {" · "}
                  {m.householdName}
                </p>
                <div className="mt-1">
                  <StatusBadge status={m.membershipStatus} />
                </div>
              </div>
              <Link
                href={`/admin/members/${m.id}`}
                className="text-sm font-medium text-green-700 hover:text-green-900"
              >
                View
              </Link>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="py-8 text-center text-gray-500">
            {search
              ? "No members match your search."
              : "No members yet. Add one to get started."}
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className={headerClass} onClick={() => handleSort("membershipNumber")}>
                # <SortIcon active={sortKey === "membershipNumber"} direction={sortDir} />
              </th>
              <th className={headerClass} onClick={() => handleSort("lastName")}>
                Name <SortIcon active={sortKey === "lastName"} direction={sortDir} />
              </th>
              <th className={headerClass} onClick={() => handleSort("email")}>
                Email <SortIcon active={sortKey === "email"} direction={sortDir} />
              </th>
              <th className={headerClass} onClick={() => handleSort("role")}>
                Role <SortIcon active={sortKey === "role"} direction={sortDir} />
              </th>
              <th className={headerClass} onClick={() => handleSort("membershipStatus")}>
                Status <SortIcon active={sortKey === "membershipStatus"} direction={sortDir} />
              </th>
              <th className={headerClass} onClick={() => handleSort("householdName")}>
                Household <SortIcon active={sortKey === "householdName"} direction={sortDir} />
              </th>
              <th className={headerClass} onClick={() => handleSort("location")}>
                Location <SortIcon active={sortKey === "location"} direction={sortDir} />
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 tabular-nums">
                  {m.membershipNumber != null
                    ? formatMembershipNumber(m.membershipNumber)
                    : "—"}
                </td>
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
                <td className="px-4 py-3">
                  <StatusBadge status={m.membershipStatus} />
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
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
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
        {sorted.length} member{sorted.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
