"use client";

import { formatCurrency } from "@/lib/utils/dates";
import { PaymentRecordForm } from "@/components/admin/PaymentRecordForm";

interface ApprovedApp {
  membershipId: string;
  householdId: string;
  householdName: string;
  householdEmail: string;
  memberFirstName: string;
  memberLastName: string;
  priceCents: number;
  discountType: string;
  tierName: string | null;
}

interface ApprovedApplicationsProps {
  applications: ApprovedApp[];
}

export function ApprovedApplications({
  applications,
}: ApprovedApplicationsProps) {
  if (applications.length === 0) {
    return (
      <div className="rounded-md border bg-gray-50 p-6 text-center text-sm text-gray-500">
        No approved applications awaiting payment.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <div
          key={app.membershipId}
          className="rounded-lg border bg-white p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900">
                {app.memberFirstName} {app.memberLastName}
              </h4>
              <p className="text-sm text-gray-500">
                {app.householdName} &middot; {app.householdEmail}
              </p>
              <div className="mt-1 flex gap-2">
                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {app.tierName ?? "Unknown Tier"}
                </span>
                {app.discountType !== "NONE" && (
                  <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    {app.discountType}
                  </span>
                )}
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(app.priceCents)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <PaymentRecordForm
              membershipId={app.membershipId}
              priceCents={app.priceCents}
              householdName={app.householdName}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
