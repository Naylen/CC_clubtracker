import Link from "next/link";
import { Menu } from "lucide-react";
import { signOut } from "@/lib/auth-client";

interface HeaderProps {
  title: string;
  userEmail?: string;
  isAdmin?: boolean;
  onMenuToggle?: () => void;
}

export function Header({ title, userEmail, isAdmin, onMenuToggle }: HeaderProps) {
  return (
    <header className="border-b bg-white px-3 py-4 md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {isAdmin && onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="rounded-md p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <Link href={isAdmin ? "/admin/dashboard" : "/member/dashboard"}>
            <h1 className="text-lg font-bold text-green-800">MCFGC</h1>
          </Link>
          <span className="text-sm text-gray-500">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="hidden text-sm text-gray-600 md:inline">{userEmail}</span>
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
