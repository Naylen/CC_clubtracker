import {
  getPendingApplications,
  getApprovedAwaitingPayment,
} from "@/actions/memberships";
import { getMembershipTiers } from "@/actions/membership-tiers";
import { getCurrentMembershipYear } from "@/actions/membership-years";
import { ApplicationQueue } from "@/components/admin/ApplicationQueue";
import { ApprovedApplications } from "@/components/admin/ApprovedApplications";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const [pendingApps, approvedApps, tiers, currentYear] = await Promise.all([
    getPendingApplications(),
    getApprovedAwaitingPayment(),
    getMembershipTiers(),
    getCurrentMembershipYear(),
  ]);

  const membershipYear = currentYear?.year ?? new Date().getFullYear();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Membership Applications
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review new member applications, assign tiers, and record payments.
        </p>
      </div>

      {/* Pending Review */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">
          Pending Review
          {pendingApps.length > 0 && (
            <span className="ml-2 inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-sm font-medium text-yellow-700">
              {pendingApps.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          New applications that need tier assignment and approval.
        </p>
        <div className="mt-4">
          <ApplicationQueue
            applications={pendingApps}
            tiers={tiers}
            membershipYear={membershipYear}
          />
        </div>
      </section>

      {/* Approved — Awaiting Payment */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">
          Approved — Awaiting Payment
          {approvedApps.length > 0 && (
            <span className="ml-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-sm font-medium text-blue-700">
              {approvedApps.length}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Applications approved with tier assigned. Record payment to activate
          membership.
        </p>
        <div className="mt-4">
          <ApprovedApplications applications={approvedApps} />
        </div>
      </section>
    </div>
  );
}
