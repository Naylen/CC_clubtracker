import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { member, membership, membershipYear } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { RenewalCard } from "@/components/member/RenewalCard";

export const dynamic = "force-dynamic";

export default async function RenewPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/magic-link");

  const memberRecord = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);

  if (!memberRecord[0]) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Renewal</h2>
        <p className="mt-2 text-gray-600">
          Your account is not linked to a household. Please contact a club
          officer.
        </p>
      </div>
    );
  }

  // Get current membership year
  const currentYear = new Date().getFullYear();
  const yearRecord = await db
    .select()
    .from(membershipYear)
    .where(eq(membershipYear.year, currentYear))
    .limit(1);

  if (!yearRecord[0]) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Renewal</h2>
        <p className="mt-2 text-gray-600">
          The {currentYear} membership year has not been configured yet. Please
          check back later.
        </p>
      </div>
    );
  }

  const membershipRecord = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.householdId, memberRecord[0].householdId),
        eq(membership.membershipYearId, yearRecord[0].id),
      ),
    )
    .limit(1);

  if (!membershipRecord[0]) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Renewal</h2>
        <p className="mt-2 text-gray-600">
          No membership record found for {currentYear}. If you believe this is
          an error, please contact a club officer.
        </p>
      </div>
    );
  }

  // Check if we're within the renewal window
  const now = new Date();
  const renewalOpen = new Date(yearRecord[0].opensAt);
  const renewalDeadline = new Date(yearRecord[0].renewalDeadline);
  const isWithinRenewalWindow = now >= renewalOpen && now <= renewalDeadline;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">
        {currentYear} Membership Renewal
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Renew your MCFGC membership for the {currentYear} season.
      </p>

      <div className="mt-6">
        <RenewalCard
          membershipId={membershipRecord[0].id}
          status={membershipRecord[0].status}
          priceCents={membershipRecord[0].priceCents}
          discountType={membershipRecord[0].discountType}
          year={currentYear}
          renewalWindowOpen={isWithinRenewalWindow}
          renewalOpensAt={yearRecord[0].opensAt.toISOString()}
          renewalDeadline={yearRecord[0].renewalDeadline.toISOString()}
        />
      </div>
    </div>
  );
}
