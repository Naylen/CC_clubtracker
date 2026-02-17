"use client";

import { useEffect, useState } from "react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        onMenuToggle={() => setSidebarOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
