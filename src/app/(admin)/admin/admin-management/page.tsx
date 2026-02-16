import { getAdminMembers } from "@/actions/admin";
import { AdminManagementPanel } from "@/components/admin/AdminManagementPanel";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function AdminManagementPage() {
  // Verify the current user is a SUPER_ADMIN
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const currentMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);

  if (!currentMember[0]?.isAdmin || currentMember[0].adminRole !== "SUPER_ADMIN") {
    redirect("/admin/dashboard");
  }

  const admins = await getAdminMembers();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Admin Management</h2>
      <p className="mt-1 text-sm text-gray-500">
        Manage administrator roles and permissions. Only Super Admins can access
        this page.
      </p>

      <div className="mt-6">
        <AdminManagementPanel
          admins={admins}
          currentMemberId={currentMember[0].id}
        />
      </div>
    </div>
  );
}
