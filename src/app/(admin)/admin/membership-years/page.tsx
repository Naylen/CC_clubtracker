import Link from "next/link";
import { getMembershipYears } from "@/actions/membership-years";
import { formatDateET } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function MembershipYearsPage() {
  const years = await getMembershipYears();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Membership Years</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure annual membership periods, capacity, and deadlines.
          </p>
        </div>
        <Link
          href="/admin/membership-years/new"
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          Create Year
        </Link>
      </div>

      {/* Mobile cards */}
      <div className="mt-6 space-y-3 md:hidden">
        {years.map((y) => (
          <div key={y.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-medium">{y.year}</p>
              <Link
                href={`/admin/membership-years/${y.id}`}
                className="text-sm font-medium text-green-700 hover:text-green-900"
              >
                Manage
              </Link>
            </div>
            <div className="mt-1 text-sm text-gray-500">
              <p>Cap: {y.capacityCap} households</p>
              <p>
                Renewal: {formatDateET(y.opensAt)} – {formatDateET(y.renewalDeadline)}
              </p>
            </div>
          </div>
        ))}
        {years.length === 0 && (
          <p className="py-8 text-center text-gray-500">
            No membership years configured yet.
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="mt-6 hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Year</th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Renewal Window Opens
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Renewal Window Closes
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">
                Capacity Cap
              </th>
              <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {years.map((y) => (
              <tr key={y.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{y.year}</td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDateET(y.opensAt)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDateET(y.renewalDeadline)}
                </td>
                <td className="px-4 py-3 text-gray-600">{y.capacityCap}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/membership-years/${y.id}`}
                    className="text-green-700 hover:text-green-900"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {years.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No membership years configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
