import Link from "next/link";
import { MembershipTierForm } from "@/components/admin/MembershipTierForm";

export default function NewMembershipTierPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/membership-tiers"
          className="text-sm text-green-700 hover:underline"
        >
          &larr; Back to Membership Tiers
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Create Membership Tier
        </h1>
      </div>

      <MembershipTierForm mode="create" />
    </div>
  );
}
