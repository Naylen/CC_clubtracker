"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setAdminRole,
  removeAdminRole,
  searchMembersForAdmin,
} from "@/actions/admin";
import type { AdminRole } from "@/types";

interface AdminMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isAdmin: boolean;
  adminRole: string | null;
  createdAt: Date;
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isAdmin: boolean;
  adminRole: string | null;
}

interface Props {
  admins: AdminMember[];
  currentMemberId: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-purple-100 text-purple-700",
  OFFICER: "bg-blue-100 text-blue-700",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  OFFICER: "Officer",
};

export function AdminManagementPanel({ admins, currentMemberId }: Props) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSearch(query: string) {
    setSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await searchMembersForAdmin(query);
    setSearchResults(results);
    setSearching(false);
  }

  async function handlePromote(memberId: string, role: AdminRole) {
    setError(null);
    setLoading(memberId);
    const result = await setAdminRole(memberId, role);
    setLoading(null);
    if (result.success) {
      setShowAddForm(false);
      setSearch("");
      setSearchResults([]);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleRemove(memberId: string) {
    setError(null);
    setLoading(memberId);
    const result = await removeAdminRole(memberId);
    setLoading(null);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleChangeRole(memberId: string, newRole: AdminRole) {
    setError(null);
    setLoading(memberId);
    const result = await setAdminRole(memberId, newRole);
    setLoading(null);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* RBAC Info Card */}
      <div className="rounded-lg border bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Role Permissions
        </h3>
        <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
          <div className="rounded-md bg-white p-3 border">
            <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Super Admin
            </span>
            <ul className="mt-2 space-y-1 text-gray-600">
              <li>All permissions</li>
              <li>Manage admin roles</li>
              <li>Cannot be removed</li>
            </ul>
          </div>
          <div className="rounded-md bg-white p-3 border">
            <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              Admin
            </span>
            <ul className="mt-2 space-y-1 text-gray-600">
              <li>Manage members & households</li>
              <li>Create membership years</li>
              <li>Manage payments & broadcasts</li>
              <li>View audit log</li>
            </ul>
          </div>
          <div className="rounded-md bg-white p-3 border">
            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Officer
            </span>
            <ul className="mt-2 space-y-1 text-gray-600">
              <li>View members & households</li>
              <li>Manage sign-up day</li>
              <li>View payments</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Current Admins Table */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Current Administrators ({admins.length})
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            {showAddForm ? "Cancel" : "+ Add Admin"}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {admins.map((admin) => {
                const isSelf = admin.id === currentMemberId;
                const roleKey = admin.adminRole ?? "ADMIN";

                return (
                  <tr key={admin.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {admin.firstName} {admin.lastName}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {admin.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          ROLE_COLORS[roleKey] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ROLE_LABELS[roleKey] ?? roleKey}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isSelf || admin.adminRole === "SUPER_ADMIN" ? (
                        <span className="text-xs text-gray-400">
                          {isSelf ? "Cannot edit self" : "Protected"}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={admin.adminRole ?? ""}
                            onChange={(e) =>
                              handleChangeRole(
                                admin.id,
                                e.target.value as AdminRole,
                              )
                            }
                            disabled={loading === admin.id}
                            className="rounded-md border px-2 py-1 text-xs"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="OFFICER">Officer</option>
                          </select>
                          <button
                            onClick={() => handleRemove(admin.id)}
                            disabled={loading === admin.id}
                            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Admin Form */}
      {showAddForm && (
        <div className="rounded-lg border bg-gray-50 p-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">
            Promote Member to Admin
          </h4>
          <p className="text-xs text-gray-500">
            Search for an existing member to grant admin privileges.
          </p>

          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
          />

          {searching && (
            <p className="text-xs text-gray-500">Searching...</p>
          )}

          {searchResults.length > 0 && (
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 font-medium text-gray-500">
                      Name
                    </th>
                    <th className="px-4 py-2 font-medium text-gray-500">
                      Email
                    </th>
                    <th className="px-4 py-2 font-medium text-gray-500">
                      Assign Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {searchResults.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {m.firstName} {m.lastName}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {m.email ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePromote(m.id, "ADMIN")}
                            disabled={loading === m.id}
                            className="rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                          >
                            Admin
                          </button>
                          <button
                            onClick={() => handlePromote(m.id, "OFFICER")}
                            disabled={loading === m.id}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Officer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {search.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-500">
              No non-admin members found matching your search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
