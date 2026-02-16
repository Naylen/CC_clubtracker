import { NewMemberForm } from "@/components/admin/NewMemberForm";
import Link from "next/link";

export default function NewMemberPage() {
  return (
    <div>
      <Link
        href="/admin/members"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to Members
      </Link>
      <h2 className="mt-2 text-2xl font-bold text-gray-900">Add New Member</h2>
      <p className="mt-1 text-sm text-gray-500">
        Register a new member. This will create their household automatically.
        You can add household members (dependents) after creation.
      </p>
      <div className="mt-6">
        <NewMemberForm />
      </div>
    </div>
  );
}
