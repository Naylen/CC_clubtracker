"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { useSession } from "@/lib/auth-client";
import { checkMustChangePassword } from "@/actions/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Check if the logged-in user must change their password
    checkMustChangePassword().then((mustChange) => {
      if (mustChange) {
        router.replace("/change-password");
      }
    });
  }, [router]);

  return (
    <div className="flex h-screen flex-col">
      <Header
        title="Admin"
        userEmail={session?.user?.email}
        isAdmin
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
