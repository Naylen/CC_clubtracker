import Link from "next/link";
import { getHouseholds } from "@/actions/households";
import { HouseholdTable } from "@/components/admin/HouseholdTable";

export const dynamic = "force-dynamic";

export default async function HouseholdsPage() {
  const households = await getHouseholds();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Households</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage member households and their details.
          </p>
        </div>
        <Link
          href="/admin/households/new"
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          Add Household
        </Link>
      </div>

      <div className="mt-6">
        <HouseholdTable households={households} />
      </div>
    </div>
  );
}
