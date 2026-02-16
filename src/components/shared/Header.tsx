import Link from "next/link";
import { signOut } from "@/lib/auth-client";

interface HeaderProps {
  title: string;
  userEmail?: string;
  isAdmin?: boolean;
}

export function Header({ title, userEmail, isAdmin }: HeaderProps) {
  return (
    <header className="border-b bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={isAdmin ? "/admin/dashboard" : "/member/dashboard"}>
            <h1 className="text-lg font-bold text-green-800">MCFGC</h1>
          </Link>
          <span className="text-sm text-gray-500">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-sm text-gray-600">{userEmail}</span>
          )}
          <button
            onClick={() => signOut()}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
