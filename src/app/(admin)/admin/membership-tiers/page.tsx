import Link from "next/link";
import { getAllMembershipTiers } from "@/actions/membership-tiers";
import { MembershipTierTable } from "@/components/admin/MembershipTierTable";

export const dynamic = "force-dynamic";

export default async function MembershipTiersPage() {
  const tiers = await getAllMembershipTiers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Membership Tiers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage membership tier types and pricing.
          </p>
        </div>
        <Link
          href="/admin/membership-tiers/new"
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          + New Tier
        </Link>
      </div>

      <MembershipTierTable tiers={tiers} />
    </div>
  );
}
