import { notFound } from "next/navigation";
import { getHouseholdById } from "@/actions/households";
import { getMembersByHousehold } from "@/actions/members";
import { getMembershipsByHousehold } from "@/actions/memberships";
import { HouseholdForm } from "@/components/admin/HouseholdForm";
import { formatCurrency, formatDateET } from "@/lib/utils/dates";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HouseholdDetailPage({ params }: Props) {
  const { id } = await params;
  const household = await getHouseholdById(id);

  if (!household) notFound();

  const members = await getMembersByHousehold(id);
  const memberships = await getMembershipsByHousehold(id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/households"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Households
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">
          {household.name}
        </h2>
      </div>

      {/* Household Details */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">
          Household Details
        </h3>
        <div className="mt-4">
          <HouseholdForm household={household} />
        </div>
      </section>

      {/* Members */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">Members</h3>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500">DOB</th>
                <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 font-medium text-gray-500">
                  Veteran
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {m.firstName} {m.lastName}
                  </td>
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
                  <td className="px-4 py-3 text-gray-600">{m.dateOfBirth}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.isVeteranDisabled ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.isAdmin ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Membership History */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">
          Membership History
        </h3>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Price</th>
                <th className="px-4 py-3 font-medium text-gray-500">
                  Discount
                </th>
                <th className="px-4 py-3 font-medium text-gray-500">
                  Enrolled
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {memberships.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        m.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : m.status === "LAPSED"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatCurrency(m.priceCents)}</td>
                  <td className="px-4 py-3 text-gray-600">{m.discountType}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.enrolledAt ? formatDateET(m.enrolledAt) : "—"}
                  </td>
                </tr>
              ))}
              {memberships.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No memberships yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
