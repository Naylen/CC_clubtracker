import { notFound } from "next/navigation";
import { getMembershipYearById } from "@/actions/membership-years";
import { getSignupEvent } from "@/actions/signup-events";
import { getMembershipsByYear } from "@/actions/memberships";
import { getCapacityDisplay } from "@/lib/utils/capacity";
import { MembershipYearForm } from "@/components/admin/MembershipYearForm";
import { CapacityGauge } from "@/components/admin/CapacityGauge";
import { SignupEventToggle } from "@/components/admin/SignupEventToggle";
import { formatCurrency, formatDateET } from "@/lib/utils/dates";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MembershipYearDetailPage({ params }: Props) {
  const { id } = await params;
  const year = await getMembershipYearById(id);

  if (!year) notFound();

  const signupEvent = await getSignupEvent(id);
  const memberships = await getMembershipsByYear(id);
  const capacity = await getCapacityDisplay(id, year.capacityCap);

  const statusCounts = memberships.reduce(
    (acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/membership-years"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Years
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">
          {year.year} Membership Year
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CapacityGauge occupied={capacity.occupied} cap={capacity.cap} />

        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Status Breakdown
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-medium text-green-700">
                {statusCounts["ACTIVE"] ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending Renewal</span>
              <span className="font-medium text-yellow-700">
                {statusCounts["PENDING_RENEWAL"] ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">New Pending</span>
              <span className="font-medium text-blue-700">
                {statusCounts["NEW_PENDING"] ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Lapsed</span>
              <span className="font-medium text-red-700">
                {statusCounts["LAPSED"] ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sign-Up Event */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">
          Sign-Up Day Event
        </h3>
        {signupEvent ? (
          <div className="mt-4 rounded-lg border bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-500">
                Member Visibility
              </h4>
              <SignupEventToggle
                signupEventId={signupEvent.id}
                isPublic={signupEvent.isPublic}
              />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Date</dt>
                <dd className="font-medium">{signupEvent.eventDate}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Time</dt>
                <dd className="font-medium">
                  {signupEvent.eventStartTime} – {signupEvent.eventEndTime}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Location</dt>
                <dd className="font-medium">{signupEvent.location}</dd>
              </div>
              {signupEvent.notes && (
                <div>
                  <dt className="text-gray-500">Notes</dt>
                  <dd className="font-medium">{signupEvent.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            No sign-up event configured for this year.
          </p>
        )}
      </section>

      {/* Year Settings */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">Year Settings</h3>
        <div className="mt-4">
          <MembershipYearForm membershipYear={year} />
        </div>
      </section>

      {/* Memberships Table */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">
          Memberships ({memberships.length})
        </h3>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">
                  Household
                </th>
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
                    <Link
                      href={`/admin/households/${m.householdId}`}
                      className="text-green-700 hover:text-green-900"
                    >
                      {m.householdId.slice(0, 8)}...
                    </Link>
                  </td>
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
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No memberships for this year.
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
