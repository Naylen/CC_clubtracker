import Link from "next/link";
import { getMembersWithHousehold } from "@/actions/members";
import { MemberTable } from "@/components/admin/MemberTable";

export default async function MembersPage() {
  const members = await getMembersWithHousehold();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Members</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage club members and their households.
          </p>
        </div>
        <Link
          href="/admin/members/new"
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          Add Member
        </Link>
      </div>

      <div className="mt-6">
        <MemberTable members={members} />
      </div>
    </div>
  );
}
