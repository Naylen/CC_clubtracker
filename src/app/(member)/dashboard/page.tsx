import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { member, household, membership } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatCurrency, formatDateET } from "@/lib/utils/dates";

export default async function MemberDashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/magic-link");

  // Find the member and their household
  const memberRecord = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);

  if (!memberRecord[0]) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Welcome</h2>
        <p className="mt-2 text-gray-600">
          Your account is not yet linked to a household. Please contact a club
          officer for assistance.
        </p>
      </div>
    );
  }

  const householdRecord = await db
    .select()
    .from(household)
    .where(eq(household.id, memberRecord[0].householdId))
    .limit(1);

  const memberships = await db
    .select()
    .from(membership)
    .where(eq(membership.householdId, memberRecord[0].householdId))
    .orderBy(desc(membership.createdAt));

  const householdMembers = await db
    .select()
    .from(member)
    .where(eq(member.householdId, memberRecord[0].householdId));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome, {memberRecord[0].firstName}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {householdRecord[0]?.name} household
        </p>
      </div>

      {/* Household Info */}
      <section className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Household Details
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Address</dt>
            <dd>
              {householdRecord[0]?.addressLine1}
              {householdRecord[0]?.addressLine2 && (
                <>, {householdRecord[0].addressLine2}</>
              )}
              <br />
              {householdRecord[0]?.city}, {householdRecord[0]?.state}{" "}
              {householdRecord[0]?.zip}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Contact</dt>
            <dd>
              {householdRecord[0]?.email}
              {householdRecord[0]?.phone && (
                <>
                  <br />
                  {householdRecord[0].phone}
                </>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Household Members */}
      <section className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Household Members
        </h3>
        <ul className="mt-4 divide-y text-sm">
          {householdMembers.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span>
                {m.firstName} {m.lastName}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  m.role === "PRIMARY"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Membership History */}
      <section className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Membership History
        </h3>
        <div className="mt-4 space-y-3">
          {memberships.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <div>
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
                <span className="ml-3 text-sm text-gray-600">
                  {formatCurrency(m.priceCents)}
                </span>
                {m.discountType !== "NONE" && (
                  <span className="ml-2 text-xs text-green-600">
                    ({m.discountType})
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {m.enrolledAt ? formatDateET(m.enrolledAt) : "Pending"}
              </div>
            </div>
          ))}
          {memberships.length === 0 && (
            <p className="text-sm text-gray-500">No membership records.</p>
          )}
        </div>
      </section>
    </div>
  );
}
