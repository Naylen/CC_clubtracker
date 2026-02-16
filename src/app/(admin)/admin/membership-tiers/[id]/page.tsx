import Link from "next/link";
import { notFound } from "next/navigation";
import { getMembershipTierById } from "@/actions/membership-tiers";
import { MembershipTierForm } from "@/components/admin/MembershipTierForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMembershipTierPage({ params }: PageProps) {
  const { id } = await params;
  const tier = await getMembershipTierById(id);

  if (!tier) {
    notFound();
  }

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
          Edit Membership Tier
        </h1>
      </div>

      <MembershipTierForm
        mode="edit"
        initialData={{
          id: tier.id,
          name: tier.name,
          description: tier.description ?? "",
          priceCents: tier.priceCents,
          isActive: tier.isActive,
          sortOrder: tier.sortOrder,
        }}
      />
    </div>
  );
}
