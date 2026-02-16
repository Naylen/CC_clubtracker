import { MembershipYearForm } from "@/components/admin/MembershipYearForm";

export default function NewMembershipYearPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">
        Create Membership Year
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Configure a new annual membership period with renewal window and
        capacity.
      </p>
      <div className="mt-6">
        <MembershipYearForm />
      </div>
    </div>
  );
}
