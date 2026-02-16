import { MembershipYearForm } from "@/components/admin/MembershipYearForm";
<<<<<<< HEAD
=======
import Link from "next/link";
>>>>>>> 3b5a6b1c7c2c5c2c36c5132c451c5fa924e04c52

export default function NewMembershipYearPage() {
  return (
    <div>
<<<<<<< HEAD
      <h2 className="text-2xl font-bold text-gray-900">
        Create Membership Year
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Configure a new annual membership period with renewal window and
        capacity.
=======
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
>>>>>>> 3b5a6b1c7c2c5c2c36c5132c451c5fa924e04c52
      </p>
      <div className="mt-6">
        <MembershipYearForm />
      </div>
    </div>
  );
}
