import { getCurrentMembershipYear } from "@/actions/membership-years";
import { getHouseholds } from "@/actions/households";
import { getCapacityDisplay } from "@/lib/utils/capacity";
import { CapacityGauge } from "@/components/admin/CapacityGauge";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const currentYear = await getCurrentMembershipYear();
  const households = await getHouseholds();

  let capacity = { occupied: 0, cap: 350, available: 350, isFull: false };
  if (currentYear) {
    capacity = await getCapacityDisplay(currentYear.id, currentYear.capacityCap);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
      <p className="mt-1 text-sm text-gray-500">
        Montgomery County Fish & Game Club — Admin Overview
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <CapacityGauge occupied={capacity.occupied} cap={capacity.cap} />

        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Total Households
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {households.length}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h3 className="text-sm font-medium text-gray-500">
            Current Year
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {currentYear?.year ?? "Not configured"}
          </p>
        </div>
      </div>
    </div>
  );
}
