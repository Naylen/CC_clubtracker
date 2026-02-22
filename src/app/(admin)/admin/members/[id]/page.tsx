import { notFound } from "next/navigation";
import { getMemberById, getMembersByHousehold } from "@/actions/members";
import { getHouseholdById } from "@/actions/households";
import { getMembershipsByHousehold } from "@/actions/memberships";
import { getCurrentMembershipYear } from "@/actions/membership-years";
import { HouseholdForm } from "@/components/admin/HouseholdForm";
import { AddHouseholdMemberForm } from "@/components/admin/AddHouseholdMemberForm";
import { EditMemberForm } from "@/components/admin/EditMemberForm";
import { SetTempPasswordForm } from "@/components/admin/SetTempPasswordForm";
import { DriverLicenseReveal } from "@/components/admin/DriverLicenseReveal";
import { VeteranDocViewer } from "@/components/admin/VeteranDocViewer";
import { MemberActionsSection } from "@/components/admin/MemberActionsSection";
import { formatCurrency, formatDateET } from "@/lib/utils/dates";
import { formatMembershipNumber } from "@/lib/utils/membership-number";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { MembershipStatus } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MemberDetailPage({ params }: Props) {
  const { id } = await params;
  const memberRecord = await getMemberById(id);

  if (!memberRecord) notFound();

  const household = await getHouseholdById(memberRecord.householdId);
  if (!household) notFound();

  const householdMembers = await getMembersByHousehold(
    memberRecord.householdId,
  );
  const memberships = await getMembershipsByHousehold(memberRecord.householdId);

  // Determine if current admin is a super admin (reused for temp password + member actions)
  const session = await auth.api.getSession({ headers: await headers() });
  const currentAdmin = session
    ? await db
        .select()
        .from(member)
        .where(eq(member.email, session.user.email))
        .limit(1)
    : [];
  const isSuperAdmin = currentAdmin[0]?.adminRole === "SUPER_ADMIN";

  // Find current-year membership status for member actions
  const currentMembershipYear = await getCurrentMembershipYear();
  const currentYearMembership = currentMembershipYear
    ? memberships.find(
        (m) => m.membershipYearId === currentMembershipYear.id,
      )
    : null;

  // Separate primary from dependents
  const dependents = householdMembers.filter((m) => m.role === "DEPENDENT");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/members"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Members
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">
          {memberRecord.firstName} {memberRecord.lastName}
          {memberRecord.membershipNumber != null && (
            <span className="ml-3 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
              #{formatMembershipNumber(memberRecord.membershipNumber)}
            </span>
          )}
        </h2>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
              memberRecord.role === "PRIMARY"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {memberRecord.role}
          </span>
          {memberRecord.isAdmin && (
            <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
              ADMIN
            </span>
          )}
          {memberRecord.isVeteranDisabled && (
            <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
              VETERAN
            </span>
          )}
        </div>
      </div>

      {/* Member Info (Editable) */}
      <EditMemberForm
        member={{
          id: memberRecord.id,
          householdId: memberRecord.householdId,
          firstName: memberRecord.firstName,
          lastName: memberRecord.lastName,
          email: memberRecord.email,
          dateOfBirth: memberRecord.dateOfBirth,
          role: memberRecord.role,
          isVeteranDisabled: memberRecord.isVeteranDisabled,
          isAdmin: memberRecord.isAdmin,
          membershipNumber: memberRecord.membershipNumber,
          driverLicenseState: memberRecord.driverLicenseState,
          emergencyContactName: memberRecord.emergencyContactName,
          emergencyContactPhone: memberRecord.emergencyContactPhone,
          emergencyContactRelationship: memberRecord.emergencyContactRelationship,
        }}
      />

      {/* Household Members (Dependents) */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">
          Household Members
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Other people in this member&apos;s household.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 font-medium text-gray-500">DOB</th>
                <th className="px-4 py-3 font-medium text-gray-500">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dependents.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.dateOfBirth}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email ?? "—"}</td>
                </tr>
              ))}
              {dependents.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No household members added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <AddHouseholdMemberForm householdId={memberRecord.householdId} />
        </div>
      </section>

      {/* Household Address */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900">
          Household Details
        </h3>
        <div className="mt-4">
          <HouseholdForm household={household} />
        </div>
      </section>

      {/* Sensitive Information (Admin only) */}
      {(memberRecord.driverLicenseEncrypted || memberRecord.veteranDocEncrypted) && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-lg font-semibold text-amber-900">
            Sensitive Information
          </h3>
          <p className="mt-1 text-xs text-amber-700">
            Encrypted at rest. Access is logged in the audit trail.
          </p>
          <div className="mt-4 space-y-4">
            {memberRecord.driverLicenseEncrypted && (
              <div>
                <dt className="text-sm font-medium text-gray-700">
                  Driver License
                </dt>
                <dd className="mt-1">
                  <DriverLicenseReveal memberId={memberRecord.id} />
                </dd>
              </div>
            )}
            {memberRecord.veteranDocFilename && (
              <div>
                <dt className="text-sm font-medium text-gray-700">
                  Veteran Documentation
                </dt>
                <dd className="mt-1">
                  <VeteranDocViewer
                    memberId={memberRecord.id}
                    filename={memberRecord.veteranDocFilename}
                  />
                </dd>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Temp Password (SUPER_ADMIN only) */}
      {isSuperAdmin && memberRecord.email && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900">
            Password Management
          </h3>
          <div className="mt-4 max-w-md">
            <SetTempPasswordForm
              memberId={memberRecord.id}
              memberName={`${memberRecord.firstName} ${memberRecord.lastName}`}
            />
          </div>
        </section>
      )}

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
                            : m.status === "REMOVED"
                              ? "bg-gray-200 text-gray-700"
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

      {/* Member Actions (Remove / Purge) */}
      <section className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
        <h3 className="text-lg font-semibold text-red-900">Member Actions</h3>
        <p className="mt-1 text-xs text-red-700">
          Destructive actions for this household&apos;s membership.
        </p>
        <div className="mt-4">
          <MemberActionsSection
            householdId={memberRecord.householdId}
            householdName={household.name}
            memberName={`${memberRecord.firstName} ${memberRecord.lastName}`}
            currentMembershipStatus={
              (currentYearMembership?.status as MembershipStatus) ?? null
            }
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      </section>
    </div>
  );
}
