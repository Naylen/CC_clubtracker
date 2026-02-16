import { MembershipYearForm } from "@/components/admin/MembershipYearForm";
import Link from "next/link";

export default function NewMembershipYearPage() {
  return (
    <div>
      <Link
        href="/admin/membership-years"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to Membership Years
      </Link>
      <h2 className="mt-2 text-2xl font-bold text-gray-900">
        Create Membership Year
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Configure a new calendar year membership period, capacity, and
        deadlines.
      </p>
      <div className="mt-6">
        <MembershipYearForm />
      </div>
    </div>
  );
}
