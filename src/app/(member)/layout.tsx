"use client";

import { Header } from "@/components/shared/Header";
import { useSession } from "@/lib/auth-client";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Member Portal" userEmail={session?.user?.email} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-gray-400">
        Montgomery County Fish & Game Club · 6701 Old Nest Egg Rd, Mt Sterling,
        KY 40353
      </footer>
    </div>
  );
}
